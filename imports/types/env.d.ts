declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: 'development' | 'production' | 'test';
    ROOT_URL?: string;
    MONGO_URL?: string;
    PORT?: string;
    METEOR_SETTINGS?: string;
  }
}
