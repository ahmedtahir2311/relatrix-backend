import { Injectable } from '@nestjs/common';
import { CryptoService } from '../../common/crypto.service';
import { PostgresDriver } from './postgres.driver';
import { MysqlDriver } from './mysql.driver';
import type { IDbDriver, DriverConfig } from './db-driver.interface';
import type { DbConnection } from '../../database/schema/connections';

@Injectable()
export class DbDriverFactory {
  constructor(private readonly crypto: CryptoService) {}

  createFromConnection(connection: DbConnection): IDbDriver {
    const password = this.crypto.decrypt(connection.passwordEncrypted);
    return this.createFromConfig(connection.dialect, {
      host: connection.host,
      port: connection.port,
      database: connection.database,
      username: connection.username,
      password,
      ssl: connection.ssl,
    });
  }

  createFromConfig(dialect: 'postgresql' | 'mysql', config: DriverConfig): IDbDriver {
    switch (dialect) {
      case 'postgresql':
        return new PostgresDriver(config);
      case 'mysql':
        return new MysqlDriver(config);
    }
  }
}
