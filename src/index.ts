import app from './app';
import config from './configs/env';
import connectDB from './configs/connectDb';

const startServer = async () => {
  try {
    await connectDB();
    
    app.listen(config.PORT, () => {
      console.log(`Server running in ${config.NODE_ENV} mode on port ${config.PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();