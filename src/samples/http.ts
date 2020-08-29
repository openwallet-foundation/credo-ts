import fetch, { BodyInit } from 'node-fetch';
import logger from '../lib/logger';

export async function get(url: string) {
  logger.log('HTTP GET request url', url);
  const response = await fetch(url);
  logger.log(`HTTP GET response status: ${response.status} - ${response.statusText}`);
  return response.text();
}

export async function post(url: string, body: BodyInit) {
  logger.log('HTTP POST request url', url);
  const response = await fetch(url, { method: 'POST', body });
  logger.log(`HTTP POST response status: ${response.status} - ${response.statusText}`);
  return response.text();
}
