import { randomBytes, scryptSync } from "node:crypto";
import { pool, transaction } from "../src/server/db";
async function seed() {
  if (!process.env.DEMO_PASSWORD || process.env.DEMO_PASSWORD.length < 10)
    throw Error("Define DEMO_PASSWORD con al menos 10 caracteres en .env.");
  await transaction(async (db) => {
    const names = ["Juan", "Miguel", "Tomás", "Visitante"];
    const ids: string[] = [];
    for (const name of names) {
      const email = `${name === "Tomás" ? "tomas" : name.toLowerCase()}@roomie.test`;
      const salt = randomBytes(16).toString("hex");
      const hash = `${salt}:${scryptSync(process.env.DEMO_PASSWORD!, salt, 64).toString("hex")}`;
      const { rows } = await db.query(
        "INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) ON CONFLICT(email) DO UPDATE SET email=excluded.email RETURNING id",
        [name, email, hash],
      );
      ids.push(rows[0].id);
      await db.query(
        "INSERT INTO notification_preferences(user_id) VALUES($1) ON CONFLICT DO NOTHING",
        [rows[0].id],
      );
    }
    if (
      (await db.query("SELECT id FROM memberships WHERE user_id=$1", [ids[0]]))
        .rowCount
    )
      return;
    const home = (
      await db.query(
        "INSERT INTO homes(name,address,description) VALUES('Apartamento 302','Bogotá, Colombia','Un hogar para estudiar, compartir y organizarnos juntos.') RETURNING id",
      )
    ).rows[0].id;
    for (let i = 0; i < 3; i++)
      await db.query(
        "INSERT INTO memberships(home_id,user_id,role) VALUES($1,$2,$3)",
        [home, ids[i], i === 0 ? "admin" : "member"],
      );
    await db.query(
      "INSERT INTO activities(home_id,actor_id,message) VALUES($1,$2,'creó el apartamento'),($1,$3,'se unió al apartamento'),($1,$4,'se unió al apartamento')",
      [home, ...ids.slice(0, 3)],
    );
    await db.query(
      "INSERT INTO notifications(home_id,user_id,title,message,href) VALUES($1,$2,'¡Bienvenido a Roomie!','Tu apartamento ya tiene un lugar para organizarse. Revisa quiénes comparten tu hogar.','/apartamento')",
      [home, ids[0]],
    );
    const other = (
      await db.query(
        "INSERT INTO homes(name) VALUES('Casa del visitante') RETURNING id",
      )
    ).rows[0].id;
    await db.query(
      "INSERT INTO memberships(home_id,user_id,role) VALUES($1,$2,'admin')",
      [other, ids[3]],
    );
  });
  console.log(
    "Datos de prueba preparados: juan, miguel, tomas y visitante @roomie.test.",
  );
}
seed()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
    pool.end();
  });
