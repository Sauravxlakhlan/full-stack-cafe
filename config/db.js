const mongoose = require('mongoose');

const connectDB = async () => {
  // Replace 'saurav@123' with 'saurav%40123'
  const connString = "mongodb+srv://saurav123:saurav%40123@clustercanteen.bcbkxo5.mongodb.net/canteenDB?retryWrites=true&w=majority";
  
  try {
    await mongoose.connect(connString);
    console.log('✅ MongoDB Atlas Connected Successfully');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;