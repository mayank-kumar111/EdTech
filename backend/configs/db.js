import dns from "node:dns";
import mongoose from "mongoose";

const connectDb = async () => {
    const mongoUrl = process.env.MONGODB_URL;

    if (!mongoUrl) {
        console.error(
            "MongoDB connection failed: MONGODB_URL is missing. Check backend/.env."
        );
        return false;
    }

    // Override the system DNS resolver for MongoDB SRV lookups when configured.
    // Defaults to Google Public DNS because some networks refuse SRV queries
    // through their local resolver. Set MONGODB_DNS_SERVERS in .env to override.
    const dnsServers = (
        process.env.MONGODB_DNS_SERVERS || "8.8.8.8,8.8.4.4"
    )
        .split(",")
        .map((server) => server.trim())
        .filter(Boolean);

    try {
        dns.setServers(dnsServers);
    } catch (error) {
        console.error("Could not configure DNS servers:", error.message);
        return false;
    }

    try {
        await mongoose.connect(mongoUrl, {
            serverSelectionTimeoutMS: 10000,
        });

        console.log("MongoDB connected successfully.");
        return true;
    } catch (error) {
        console.error("MongoDB connection failed:");
        console.error(error.message);
        return false;
    }
};

export default connectDb;
