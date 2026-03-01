import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("gate_control.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nfe_key TEXT NOT NULL,
    operation_type TEXT CHECK(operation_type IN ('Entrada', 'Saída')) NOT NULL,
    status TEXT CHECK(status IN ('Concluída', 'Retorno ao CD', 'Recusada', 'Saída por Recusa')) NOT NULL,
    reason TEXT,
    vehicle_plate TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS vehicles (
    plate TEXT PRIMARY KEY,
    model TEXT,
    driver_name TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_nfe_key ON movements(nfe_key);
`);

const seedVehicles = () => {
  const vehicles = [
    { plate: 'PNZ4406', model: 'MB08' },
    { plate: 'ORZ0465', model: 'MB09' },
    { plate: 'HWL7403', model: 'MB18' },
    { plate: 'HXY7945', model: 'MB19' },
    { plate: 'OSA6711', model: 'MB20' },
    { plate: 'OSL9998', model: 'MB21' },
    { plate: 'PMH9219', model: 'MB23' },
    { plate: 'OCF9681', model: 'MB24' },
    { plate: 'OSU7145', model: 'MB49' },
    { plate: 'POW9495', model: 'MB51' },
    { plate: 'PNR2C84', model: 'MB55' },
    { plate: 'POR0C93', model: 'MB56' },
    { plate: 'POZ5F66', model: 'MB59' },
    { plate: 'OIM0086', model: 'MB60' },
    { plate: 'SBK9I25', model: 'MB62' },
    { plate: 'SBV7I66', model: 'MB63' },
    { plate: 'SBD9F47', model: 'MB65' },
    { plate: 'SAX9B97', model: 'MB66' },
    { plate: 'SBT6A94', model: 'MB67' },
    { plate: 'NIU2I54', model: 'MB69' },
    { plate: 'THN6F19', model: 'MB71' },
    { plate: 'PNY8C03', model: 'MB73' },
  ];

  const insert = db.prepare("INSERT OR IGNORE INTO vehicles (plate, model) VALUES (?, ?)");
  const transaction = db.transaction((list) => {
    for (const v of list) insert.run(v.plate, v.model);
  });
  transaction(vehicles);
};

seedVehicles();

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API Routes
  app.get("/api/movements", (req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM movements ORDER BY timestamp DESC").all();
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar movimentações" });
    }
  });

  app.get("/api/vehicles", (req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM vehicles ORDER BY plate ASC").all();
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar veículos" });
    }
  });

  app.get("/api/movements/count/:key", (req, res) => {
    const { key } = req.params;
    try {
      const result = db.prepare("SELECT COUNT(*) as count FROM movements WHERE nfe_key = ?").get(key) as { count: number };
      res.json({ count: result.count });
    } catch (error) {
      res.status(500).json({ error: "Erro ao contar movimentações" });
    }
  });

  app.post("/api/vehicles", (req, res) => {
    const { plate, model, driver_name } = req.body;
    if (!plate) return res.status(400).json({ error: "Placa é obrigatória" });
    try {
      db.prepare("INSERT OR REPLACE INTO vehicles (plate, model, driver_name) VALUES (?, ?, ?)")
        .run(plate.toUpperCase(), model, driver_name);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao salvar veículo" });
    }
  });

  app.post("/api/movements", (req, res) => {
    const body = req.body;
    const isBatch = Array.isArray(body.nfe_keys);
    const movementsToProcess = isBatch 
      ? body.nfe_keys.map((key: string) => ({ ...body, nfe_key: key }))
      : [body];

    const results: any[] = [];
    const getNFNumber = (key: string) => {
      if (key.length === 44) {
        return `NF ${key.slice(25, 34).replace(/^0+/, '')}`;
      }
      return `Chave ${key}`;
    };

    const transaction = db.transaction((items) => {
      for (const item of items) {
        const { nfe_key, operation_type, status, reason, vehicle_plate } = item;
        const nfDisplay = getNFNumber(nfe_key);

        if (!nfe_key || !operation_type || !status || !vehicle_plate) {
          throw new Error(`Campos obrigatórios ausentes para ${nfDisplay}`);
        }

        if (status !== 'Concluída' && !reason) {
          throw new Error(`Motivo é obrigatório para ${nfDisplay} com status ${status}`);
        }

        const lastMovement = db.prepare(
          "SELECT * FROM movements WHERE nfe_key = ? ORDER BY timestamp DESC LIMIT 1"
        ).get(nfe_key) as any;

        if (operation_type === 'Saída') {
          if (status === 'Saída por Recusa') {
            if (!lastMovement || lastMovement.operation_type !== 'Entrada') {
              throw new Error(`Erro ${nfDisplay}: Para registrar Saída por Recusa, a NF deve estar no estoque.`);
            }
          } else {
            if (lastMovement && lastMovement.operation_type === 'Saída') {
              throw new Error(`Erro ${nfDisplay}: NF já saiu e não retornou.`);
            }
          }
        } else if (operation_type === 'Entrada') {
          if (status === 'Retorno ao CD' || status === 'Recusada') {
            if (!lastMovement || lastMovement.operation_type !== 'Saída') {
              throw new Error(`Erro ${nfDisplay}: Para registrar ${status}, a NF deve ter uma Saída prévia.`);
            }
          } else {
            if (lastMovement && lastMovement.operation_type === 'Entrada') {
              throw new Error(`Erro ${nfDisplay}: NF já deu entrada e está no estoque.`);
            }
          }
        }

        db.prepare(
          "INSERT INTO movements (nfe_key, operation_type, status, reason, vehicle_plate) VALUES (?, ?, ?, ?, ?)"
        ).run(nfe_key, operation_type, status, reason || null, vehicle_plate.toUpperCase());
      }
    });

    try {
      transaction(movementsToProcess);
      res.json({ success: true, count: movementsToProcess.length });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
