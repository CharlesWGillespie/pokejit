
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Test the database connection
    if (url.pathname === "/api/health") {
      try {
        await env.DB.prepare("SELECT 1").first();

        return Response.json({
          app: "PokeDrop Sniper",
          status: "online",
          database: "connected",
          monitoring: "not configured yet"
        });
      } catch (error) {
        return Response.json({
          app: "PokeDrop Sniper",
          status: "error",
          database: "disconnected"
        }, { status: 500 });
      }
    }

    // Dashboard
    if (url.pathname === "/") {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PokéDrop Sniper</title>
<style>
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #10131b;
  color: #f4f5f8;
  font-family: Arial, sans-serif;
}
header {
  padding: 25px;
  background: #191e2a;
  border-bottom: 1px solid #303849;
}
main {
  max-width: 1000px;
  margin: auto;
  padding: 25px;
}
h1 { margin: 0; font-size: 25px; }
.subtitle { color: #9ba6b8; margin-top: 8px; }
.status {
  display: inline-block;
  color: #65e6a1;
  background: #173c30;
  padding: 7px 12px;
  border-radius: 20px;
  font-size: 12px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit,minmax(200px,1fr));
  gap: 15px;
  margin-top: 25px;
}
.card {
  background: #191e2a;
  border: 1px solid #303849;
  border-radius: 12px;
  padding: 20px;
}
.card h3 { margin-top: 0; }
.muted { color: #9ba6b8; font-size: 13px; }
.value { font-size: 22px; font-weight: bold; }
section { margin-top: 30px; }
.store {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #303849;
  padding: 16px 0;
}
.pending { color: #f5c46b; font-size: 12px; }
footer {
  color: #788397;
  font-size: 12px;
  margin-top: 35px;
}
</style>
</head>
<body>
<header>
  <h1>🎴 PokéDrop Sniper</h1>
  <div class="subtitle">Your Pokémon TCG restock dashboard</div>
</header>
<main>
  <span class="status">● CLOUD WORKER ONLINE</span>

  <div class="grid">
    <div class="card">
      <div class="muted">RETAILERS</div>
      <p class="value">4</p>
      <div class="muted">Configured targets</div>
    </div>
    <div class="card">
      <div class="muted">PRODUCTS</div>
      <p class="value">0</p>
      <div class="muted">Products being tracked</div>
    </div>
    <div class="card">
      <div class="muted">ACTIVE ALERTS</div>
      <p class="value">0</p>
      <div class="muted">No alerts configured</div>
    </div>
  </div>

  <section>
    <h2>Retailer connections</h2>
    <div class="card">
      <div class="store">
        <strong>Pokémon Center</strong>
        <span class="pending">Not connected</span>
      </div>
      <div class="store">
        <strong>Best Buy</strong>
        <span class="pending">Not connected</span>
      </div>
      <div class="store">
        <strong>GameStop</strong>
        <span class="pending">Not connected</span>
      </div>
      <div class="store">
        <strong>Costco</strong>
        <span class="pending">Not connected</span>
      </div>
    </div>
  </section>

  <section>
    <h2>Monitoring configuration</h2>
    <div class="card">
      <p>Price filtering: Not configured</p>
      <p>Scheduled checks: Not configured</p>
      <p>SMS notifications: Not configured</p>
      <p class="muted">
        Your dashboard is online. Monitoring integrations
        will be added in upcoming development steps.
      </p>
    </div>
  </section>

  <footer>PokéDrop Sniper · Cloud-hosted application</footer>
</main>
</body>
</html>`;

      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=UTF-8" }
      });
    }

    return new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
