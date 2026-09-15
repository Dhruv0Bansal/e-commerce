import { useEffect, useState } from 'react';

const services = [
  ['Auth', '/api/user'],
  ['Products', '/api/product'],
  ['Cart', '/api/cart'],
  ['Inventory', '/api/inventory'],
  ['Checkout', '/api/checkout'],
];

async function getJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function App() {
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [health, setHealth] = useState({});
  const [token, setToken] = useState(() => localStorage.getItem('ecommerce-token') || '');
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    setLoading(true);
    const [productData, inventoryData] = await Promise.all([
      getJson('/api/product'),
      getJson('/api/inventory'),
    ]);
    setProducts(productData.products || []);
    setInventory(inventoryData.inventory || []);

    const checks = await Promise.allSettled(services.map(async ([name, url]) => [name, await getJson(url)]));
    setHealth(Object.fromEntries(checks.filter((result) => result.status === 'fulfilled').map((result) => result.value)));
    setLoading(false);
  };

  useEffect(() => {
    loadDashboard().catch((error) => {
      setMessage(error.message);
      setLoading(false);
    });
  }, []);

  const submitAuth = async (event) => {
    event.preventDefault();
    setMessage('');
    try {
      const endpoint = authMode === 'login' ? '/api/user/login' : '/api/user/register';
      const data = await getJson(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm),
      });
      localStorage.setItem('ecommerce-token', data.token);
      setToken(data.token);
      setMessage(`${authMode === 'login' ? 'Logged in' : 'Account created'} as ${data.user.email}`);
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div><span className="eyebrow">COMMERCE CONTROL</span><h1>Storefront systems</h1></div>
        <div className="live-pill"><span /> Live through Nginx :8080</div>
      </header>

      <section className="hero">
        <div><p className="eyebrow">STEPS 1 — 6 ONLINE</p><h2>Your commerce backbone, in one view.</h2><p className="hero-copy">Products, inventory, authentication, Kafka events, and database replication are connected and ready for the next workflow.</p></div>
        <button className="refresh" onClick={() => loadDashboard().catch((error) => setMessage(error.message))}>{loading ? 'Refreshing...' : 'Refresh data'}</button>
      </section>

      <section className="service-grid">
        {services.map(([name]) => <div className="service-card" key={name}><span className={health[name] ? 'dot online' : 'dot'} /> <strong>{name}</strong><small>{health[name] ? 'Operational' : 'Checking...'}</small></div>)}
      </section>

      <div className="content-grid">
        <section className="panel"><div className="panel-heading"><div><span className="eyebrow">CATALOG</span><h3>Products</h3></div><span className="count">{products.length} items</span></div>
          {products.length === 0 ? <p className="empty">No products found.</p> : <div className="product-list">{products.map((product) => <article className="product-row" key={product.id}><div><strong>{product.name}</strong><p>{product.description || 'No description'}</p></div><div className="price">${Number(product.price).toFixed(2)}<small>ID {product.id}</small></div></article>)}</div>}
        </section>

        <section className="panel"><div className="panel-heading"><div><span className="eyebrow">STOCK LEDGER</span><h3>Inventory</h3></div><span className="replica-tag">Replica reads</span></div>
          {inventory.length === 0 ? <p className="empty">Inventory appears after a product-created event.</p> : <div className="inventory-list">{inventory.map((item) => <div className="inventory-row" key={item.product_id}><span>Product {item.product_id}</span><strong>{item.quantity} available</strong><small>{item.reserved_quantity} reserved</small></div>)}</div>}
        </section>

        <section className="panel auth-panel"><div className="panel-heading"><div><span className="eyebrow">ACCESS</span><h3>{authMode === 'login' ? 'Welcome back' : 'Create account'}</h3></div><span className={token ? 'replica-tag active' : 'replica-tag'}>{token ? 'JWT active' : 'Signed out'}</span></div>
          <form onSubmit={submitAuth}>{authMode === 'register' && <input placeholder="Name" value={authForm.name} onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} required />}<input type="email" placeholder="Email" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} required /><input type="password" placeholder="Password" value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} required /><button className="primary-button" type="submit">{authMode === 'login' ? 'Log in' : 'Register'}</button></form>
          <button className="text-button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>{authMode === 'login' ? 'Need an account?' : 'Already registered?'}</button>{message && <p className="form-message">{message}</p>}
        </section>
      </div>
    </main>
  );
}

export default App;
