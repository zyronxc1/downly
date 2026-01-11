"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = void 0;
/**
 * 404 handler middleware
 * Handles requests to unknown routes
 */
const notFound = (req, res, next) => {
    res.status(404).json({
        error: {
            message: `Route ${req.method} ${req.path} not found`,
        },
    });
};
exports.notFound = notFound;
//# sourceMappingURL=notFound.js.map