-- Foundation migration: enable geospatial support before domain migrations.
CREATE EXTENSION IF NOT EXISTS postgis;
