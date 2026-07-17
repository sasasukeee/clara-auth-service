import axios, { AxiosHeaders } from 'axios';
import { getInternalHeaders } from './internal-headers';

const gatewayHost = process.env.GATEWAY_HOST ?? 'http://localhost';
const gatewayPort = process.env.GATEWAY_PORT ?? '3000';
const gatewayId = process.env.GATEWAY_ID ?? 'auth';
const internalHeaders = getInternalHeaders(gatewayId);

export const gatewayHttp = axios.create({
  baseURL: `${gatewayHost}:${gatewayPort}`,
  timeout: 5000,
});

gatewayHttp.interceptors.request.use((config) => {
  const headers = AxiosHeaders.from(config.headers ?? {});
  headers.set('x-internal-secret', internalHeaders['x-internal-secret']);
  headers.set('x-gateway-id', internalHeaders['x-gateway-id']);
  config.headers = headers;

  return config;
});
