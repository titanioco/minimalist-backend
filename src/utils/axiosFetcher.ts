import { FetcherFunction } from "@paraswap/sdk";
import axios from "axios";

export const axiosFetcher: FetcherFunction = async (params) => {
  const { url, method, headers } = params;
  const config: any = { url, method, headers };
  
  if (method === 'POST' && 'data' in params) {
    config.data = params.data;
  }
  
  const response = await axios(config);
  return response.data;
};