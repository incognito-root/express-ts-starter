import express from "express";

import authRoutes from "./authRoutes";

const router = express.Router();

router.use("/auth", authRoutes);

// Add your domain routes here:
// import userRoutes from "./userRoutes";
// router.use("/users", userRoutes);

export default router;
