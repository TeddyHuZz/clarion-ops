\set ON_ERROR_STOP on

\getenv data_service_db DATA_SERVICE_DB
\getenv data_service_user DATA_SERVICE_USER
\getenv data_service_password DATA_SERVICE_PASSWORD
\getenv data_service_schema DATA_SERVICE_SCHEMA

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = :'data_service_user'
  ) THEN
    EXECUTE format(
      'CREATE ROLE %I LOGIN PASSWORD %L',
      :'data_service_user',
      :'data_service_password'
    );
  END IF;
END
$$;

SELECT format('CREATE DATABASE %I OWNER %I', :'data_service_db', :'data_service_user')
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_database
  WHERE datname = :'data_service_db'
)
\gexec

\connect :data_service_db

CREATE EXTENSION IF NOT EXISTS timescaledb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_namespace
    WHERE nspname = :'data_service_schema'
  ) THEN
    EXECUTE format(
      'CREATE SCHEMA %I AUTHORIZATION %I',
      :'data_service_schema',
      :'data_service_user'
    );
  END IF;

  EXECUTE format(
    'ALTER ROLE %I SET search_path = %I, public',
    :'data_service_user',
    :'data_service_schema'
  );

  EXECUTE format(
    'GRANT CONNECT, TEMPORARY ON DATABASE %I TO %I',
    :'data_service_db',
    :'data_service_user'
  );

  EXECUTE format(
    'GRANT USAGE, CREATE ON SCHEMA %I TO %I',
    :'data_service_schema',
    :'data_service_user'
  );

  EXECUTE format(
    'GRANT USAGE ON SCHEMA public TO %I',
    :'data_service_user'
  );

  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
    :'data_service_user',
    :'data_service_schema',
    :'data_service_user'
  );

  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO %I',
    :'data_service_user',
    :'data_service_schema',
    :'data_service_user'
  );
END
$$;