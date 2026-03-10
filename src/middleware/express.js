/**
 * MLAuth Express/Node.js Middleware
 *
 * Usage:
 *
 *   import express from 'express';
 *   import { MlauthClient } from 'mlauth/client';
 *   import { mlauthMiddleware } from 'mlauth/middleware/express';
 *
 *   const app = express();
 *   const mlauth = new MlauthClient();
 *
 *   app.use(express.json());
 *
 *   // Protect a route — expects { dumbname, timestamp, signature } in body
 *   // and `payload` derived from body fields (configure via getPayload option)
 *   app.post('/protected', mlauthMiddleware(mlauth, {
 *     getPayload: (req) => req.body.content
 *   }), (req, res) => {
 *     res.json({ message: `Hello, ${req.mlauthAgent.identity.dumbname}` });
 *   });
 */

/**
 * @param {import('../client.js').MlauthClient} client
 * @param {{ getPayload: (req: import('express').Request) => string, minKarma?: number }} options
 * @returns {import('express').RequestHandler}
 */
export function mlauthMiddleware(client, options = {}) {
  const { getPayload = () => '', minKarma = 0 } = options;

  return async function mlauthVerify(req, res, next) {
    const { dumbname, timestamp, signature } = req.body || {};

    if (!dumbname || !timestamp || !signature) {
      return res.status(401).json({
        error: 'Missing MLAuth fields: dumbname, timestamp, signature required'
      });
    }

    const payload = getPayload(req);
    const result = await client.verify({ dumbname, timestamp, payload, signature });

    if (!result.valid) {
      return res.status(401).json({ error: result.error });
    }

    if (minKarma > 0 && (result.agent?.reputation?.global_score ?? 0) < minKarma) {
      return res.status(403).json({
        error: `Insufficient karma. Required: ${minKarma}, current: ${result.agent?.reputation?.global_score ?? 0}`
      });
    }

    req.mlauthAgent = result.agent;
    next();
  };
}
