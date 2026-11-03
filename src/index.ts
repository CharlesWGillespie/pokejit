
const encoder = new TextEncoder();

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function createSession(secret: string): Promise<string> {
  const payload = encodeBase64Url(
    encoder.encode(String(Date.now() + 12 * 60 * 60 * 1000))
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    await getKey(secret),
    encoder.encode(payload)
  );
  return `${payload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

async function validSession(request: Request, secret: string): Promise<boolean> {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.split(";").map(v => v.trim())
    .find(v => v.startsWith("poke_session="));

  if (!match) return false;

  const parts = match.slice("poke_session=".length).split(".");
  if (parts.length !== 2) return false;

  try {
    const [payload, signature] = parts;
    const expiry = Number(new TextDecoder().decode(decodeBase64Url(payload)));

    if (!Number.isFinite(expiry) || expiry <= Date.now()) return false;

    return crypto.subtle.verify(
      "HMAC",
      await getKey(secret),
      decodeBase64Url(signature),
      encoder.encode(payload)
    );
  } catch {
    return false;
  }
}

async function sameSecret(a: string, b: string): Promise<boolean> {
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b))
  ]);

  const x = new Uint8Array(hashA);
  const y = new Uint8Array(hashB);
  let difference = 0;

  for (let i = 0; i < x.length; i++) difference |= x[i] ^ y[i];
  return difference === 0;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]!);
}

function money(cents: number | null): string {
  return cents === null ? "—" : `$${(cents / 100).toFixed(2)}`;
}

function parseMoney(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000) return null;
  return Math.round(amount * 100);
}

function loginPage(error = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PokéDrop Login</title>
<style>
body{background:#10131b;color:#f4f5f8;font-family:Arial;display:grid;place-items:center;min-height:100vh;margin:0}
.card{background:#191e2a;padding:30px;border:1px solid #303849;border-radius:15px;width:min(340px,85vw)}
input,button{width:100%;padding:13px;margin-top:12px;box-sizing:border-box;border-radius:8px}
input{background:#10131b;border:1px solid #454e60;color:white}
button{background:#3979ee;color:white;border:0;font-weight:bold;cursor:pointer}
.error{color:#ff8585}
</style>
</head>
<body>
<div class="card">
<h2>🎴 PokéDrop Sniper</h2>
<p>Administrator login</p>
${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
<form method="POST" action="/login">
<input type="password" name="password" placeholder="Admin password" autocomplete="current-password" required>
<button type="submit">Log in</button>
</form>
</div>
</body>
</html>`;
}

const dashboardStyle = `
<style>
*{box-sizing:border-box}
body{margin:0;background:#10131b;color:#f4f5f8;font-family:Arial}
header{padding:22px;background:#191e2a;border-bottom:1px solid #303849;display:flex;justify-content:space-between;align-items:center}
main{max-width:1100px;margin:auto;padding:22px}
.card{background:#191e2a;border:1px solid #303849;border-radius:12px;padding:20px;margin:18px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}
input,select,button{padding:12px;border-radius:8px;border:1px solid #454e60;background:#10131b;color:white;width:100%;margin:5px 0}
button{background:#3979ee;border:0;font-weight:bold;cursor:pointer}
.logout{width:auto;background:#343c4c}
form.product{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}
table{width:100%;border-collapse:collapse;min-width:720px}
th,td{text-align:left;padding:12px;border-bottom:1px solid #303849}
th{color:#9ba6b8}
.table-wrap{overflow-x:auto}
a{color:#80b4ff}
.muted{color:#9ba6b8;font-size:13px}
</style>`;

async function dashboard(env: Env): Promise<Response> {
  const { results = [] } = await env.DB.prepare(
    `SELECT id, product_name, set_name, retailer, msrp_cents,
    current_price_cents, product_url, stock_status, last_checked_at
    FROM product_listings ORDER BY created_at DESC LIMIT 100`
  ).all();

  const rows = results.map((item: any) => `
    <tr>
      <td>${escapeHtml(item.product_name)}</td>
      <td>${escapeHtml(item.set_name || "—")}</td>
      <td>${escapeHtml(item.retailer)}</td>
      <td>${money(item.msrp_cents)}</td>
      <td>${money(item.current_price_cents)}</td>
      <td>${escapeHtml(item.stock_status)}</td>
      <td><a href="${escapeHtml(item.product_url)}" target="_blank" rel="noopener noreferrer">Open product</a></td>
    </tr>
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PokéDrop Sniper</title>
${dashboardStyle}
</head>
<body>
<header>
  <div><h2>🎴 PokéDrop Sniper</h2><span class="muted">Private product manager</span></div>
  <form method="POST" action="/logout"><button class="logout">Log out</button></form>
</header>
<main>
  <div class="grid">
    <div class="card"><span class="muted">SAVED PRODUCTS</span><h2>${results.length}</h2></div>
    <div class="card"><span class="muted">RETAILERS</span><h2>4</h2></div>
    <div class="card"><span class="muted">MONITORING</span><h2>Not configured</h2></div>
  </div>

  <section class="card">
    <h2>Add a Pokémon product</h2>
    <p class="muted">Save the official product page so alerts can link directly to it.</p>
    <form class="product" method="POST" action="/api/products">
      <input name="product_name" placeholder="Product name" required maxlength="150">
      <input name="set_name" placeholder="Set name (optional)" maxlength="100">
      <select name="retailer" required>
        <option value="">Choose retailer</option>
        <option>Pokemon Center</option>
        <option>Best Buy</option>
        <option>GameStop</option>
        <option>Costco</option>
      </select>
      <input name="msrp" placeholder="MSRP in dollars (e.g. 49.99)" required>
      <input name="current_price" placeholder="Current price (optional)">
      <select name="stock_status">
        <option value="unknown">Unknown</option>
        <option value="in_stock">In stock</option>
        <option value="out_of_stock">Out of stock</option>
      </select>
      <input name="product_url" type="url" placeholder="https:// retailer product link" required>
      <button type="submit">Save product</button>
    </form>
  </section>

  <section class="card">
    <h2>Saved products</h2>
    <p class="muted">Product links open the retailer's product page. Checkout remains manual.</p>
    <div class="table-wrap">
    <table>
      <thead><tr>
        <th>Product</th><th>Set</th><th>Retailer</th><th>MSRP</th>
        <th>Current</th><th>Stock</th><th>Link</th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="7">No products added yet.</td></tr>`}</tbody>
    </table>
    </div>
  </section>
</main>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=UTF-8" }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const secret = (env as Env & { ADMIN_PASSWORD: string }).ADMIN_PASSWORD;

    if (!secret) {
      return new Response("ADMIN_PASSWORD secret is missing.", { status: 500 });
    }

    if (url.pathname === "/api/health") {
      try {
        await env.DB.prepare("SELECT 1").first();
        return Response.json({ app: "PokeDrop Sniper", status: "online", database: "connected" });
      } catch {
        return Response.json({ status: "error", database: "disconnected" }, { status: 500 });
      }
    }

    if (url.pathname === "/login" && request.method === "GET") {
      return new Response(loginPage(), {
        headers: { "Content-Type": "text/html; charset=UTF-8" }
      });
    }

    if (url.pathname === "/login" && request.method === "POST") {
      const form = await request.formData();
      const password = String(form.get("password") || "");

      if (!await sameSecret(password, secret)) {
        return new Response(loginPage("Incorrect password."), {
          status: 401,
          headers: { "Content-Type": "text/html; charset=UTF-8" }
        });
      }

      const session = await createSession(secret);
      return new Response(null, {
        status: 303,
        headers: {
          "Location": "/",
          "Set-Cookie": `poke_session=${session}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`
        }
      });
    }

    if (url.pathname === "/logout" && request.method === "POST") {
      return new Response(null, {
        status: 303,
        headers: {
          "Location": "/login",
          "Set-Cookie": "poke_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0"
        }
      });
    }

    const authenticated = await validSession(request, secret);

    if (url.pathname === "/" && request.method === "GET") {
      if (!authenticated) {
        return Response.redirect(`${url.origin}/login`, 302);
      }
      return dashboard(env);
    }

    if (url.pathname === "/api/products") {
      if (!authenticated) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (request.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT * FROM product_listings ORDER BY created_at DESC LIMIT 100"
        ).all();
        return Response.json(results);
      }

      if (request.method === "POST") {
        const form = await request.formData();
        const productName = String(form.get("product_name") || "").trim();
        const setName = String(form.get("set_name") || "").trim();
        const retailer = String(form.get("retailer") || "");
        const msrp = parseMoney(String(form.get("msrp") || ""));
        const currentRaw = String(form.get("current_price") || "").trim();
        const currentPrice = currentRaw ? parseMoney(currentRaw) : null;
        const stock = String(form.get("stock_status") || "unknown");
        const productUrl = String(form.get("product_url") || "").trim();

        const allowedRetailers = ["Pokemon Center", "Best Buy", "GameStop", "Costco"];
        const allowedStock = ["unknown", "in_stock", "out_of_stock"];

        let parsedUrl: URL;
        try {
          parsedUrl = new URL(productUrl);
        } catch {
          return new Response("Please enter a valid product URL.", { status: 400 });
        }

        const domains: Record<string, string> = {
          "Pokemon Center": "pokemoncenter.com",
          "Best Buy": "bestbuy.com",
          "GameStop": "gamestop.com",
          "Costco": "costco.com"
        };
        const domain = domains[retailer];

        if (!productName || productName.length > 150 ||
            !allowedRetailers.includes(retailer) ||
            msrp === null ||
            (currentRaw !== "" && currentPrice === null) ||
            !allowedStock.includes(stock) ||
            parsedUrl.protocol !== "https:" ||
            !domain ||
            !(parsedUrl.hostname === domain || parsedUrl.hostname.endsWith("." + domain))) {
          return new Response("Check the product name, prices, retailer, stock status and official HTTPS product URL.", { status: 400 });
        }

        try {
          await env.DB.prepare(
            `INSERT INTO product_listings
            (product_name, set_name, retailer, msrp_cents, current_price_cents,
             product_url, stock_status)
            VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            productName, setName || null, retailer, msrp,
            currentPrice, productUrl, stock
          ).run();
        } catch {
          return new Response("Could not save product. This retailer URL may already exist.", { status: 400 });
        }

        return Response.redirect(`${url.origin}/`, 303);
      }

      return new Response("Method not allowed", { status: 405 });
    }

    return new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;

