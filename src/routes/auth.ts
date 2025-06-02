import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Server as SocketIOServer } from 'socket.io';
import { HokmRoomManager } from '../game/hokm-room';
import prisma from '../lib/prisma';

// Augment Express Request to include io
interface RequestWithIO extends Request {
  io: SocketIOServer;
  roomManager: HokmRoomManager;
}

export const authRouter = Router();
const JWT_SECRET = 'your_super_secret_key'; // put in .env later

// Signup
authRouter.post('/signup', (async (req: Request, res: Response) => {
  const { username, password } = req.body;

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return res.status(409).json({ message: 'User already exists' });

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, password: hashed }
  });

  res.status(201).json({ id: user.id, username: user.username });
}) as any);

// Login
authRouter.post('/login', (async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '2h' });
  res.json({ token });
}) as any);

// Protected route
authRouter.get('/me', (async (req: RequestWithIO, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).send();

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(404).send();
    res.json({ id: user.id, username: user.username });
  } catch (err) {
    res.status(403).send();
  }
}) as any);

export default authRouter;