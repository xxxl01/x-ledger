// This file is required for Expo/React Native SQLite migrations.

import journal from "./meta/_journal.json";
import m0000 from "./0000_early_liz_osborn.sql";
import m0001 from "./0001_right_virginia_dare.sql";

export default {
  journal,
  migrations: {
    m0000,
    m0001,
  },
};
