import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { auth } from './auth';
import type { AppEnv } from './env';
import { family } from './routes/family';
import { admin, feedback } from './routes/feedback';
import { parent } from './routes/parent';
import { publicRoutes } from './routes/public';

const app = new Hono<AppEnv>();

app.use('*', cors({ origin: '*', allowHeaders: ['Authorization', 'Content-Type'], allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'] }));

app.get('/', (c) => c.json({ name: 'saathi-api', ok: true }));
app.route('/auth', auth);
app.route('/public', publicRoutes);
app.route('/public', feedback);
app.route('/admin', admin);
app.route('/parent', parent);
app.route('/', family);

app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: 'Something went wrong. Please try again.' }, 500);
});

export default app;
