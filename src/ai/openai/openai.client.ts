// src/openai/openai.client.ts
import OpenAI from 'openai';
import { Injectable } from '@nestjs/common';

@Injectable()
export class OpenAIClient {
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  getClient() {
    return this.client;
  }
}
