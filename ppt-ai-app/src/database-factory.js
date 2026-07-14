import { JsonFileDatabase } from "./database.js";
import { MySqlDocumentDatabase } from "./mysql-database.js";

/**
 * Creates the configured database adapter.
 * @param {{url: string, collections: string[], mysqlConnector?: Function}} input
 * @returns {JsonFileDatabase | MySqlDocumentDatabase}
 */
export function createDatabase({ url, collections, mysqlConnector }) {
  if (url?.startsWith("mysql://") || url?.startsWith("mysql2://") || url?.startsWith("mariadb://")) {
    return new MySqlDocumentDatabase({ url, collections, connector: mysqlConnector });
  }
  return new JsonFileDatabase({
    filePath: url?.startsWith("json:") ? url.slice("json:".length) : "./data/ppt-ai-db.json",
    collections,
  });
}

