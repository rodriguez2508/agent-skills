import { registerAs } from '@nestjs/config';

export default registerAs('bm25', () => ({
  k1: process.env.BM25_K1 ? parseFloat(process.env.BM25_K1) : 1.5,
  b: process.env.BM25_B ? parseFloat(process.env.BM25_B) : 0.75,
}));
