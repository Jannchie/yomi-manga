import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { imageRoutes } from './routes/image.js'
import { mangaRoutes } from './routes/manga.js'

const app = new Hono()

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  }),
)

app.get('/', c => c.json({ ok: true, message: 'yomi-manga api' }))
app.route('/', mangaRoutes)
app.route('/', imageRoutes)

const port = Number(process.env.PORT ?? 4347)

serve({ fetch: app.fetch, port })
