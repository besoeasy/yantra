import { spawn } from "child_process";

/**
 * Helper function to spawn a process and capture output
 * @param {string} command - The command to execute
 * @param {string[]} args - Array of arguments to pass to the command
 * @param {Object} options - Options to pass to spawn (cwd, env, etc.)
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
export function spawnProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      ...options,
      env: options.env || process.env,
    });

    let stdout = '';
    let stderr = '';

    if (proc.stdout) {
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }

    if (proc.stderr) {
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code });
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true; // Distinguish operational errors from programming errors
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Bad request error (400)
 */
export class BadRequestError extends AppError {
  constructor(message, details = null) {
    super(message, 400, details);
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(message, details = null) {
    super(message, 404, details);
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends AppError {
  constructor(message, details = null) {
    super(message, 409, details);
  }
}

/**
 * Docker-specific error
 */
export class DockerError extends AppError {
  constructor(message, details = null) {
    super(message, 500, details);
  }
}

/**
 * Fastify error handler — register with fastify.setErrorHandler(errorHandler)
 * @param {Error} err
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export function errorHandler(err, request, reply) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ❌ [ERROR] ${request.method} ${request.url}`);
  console.error(`[${timestamp}] ❌ [ERROR] ${err.stack || err.message}`);

  // Operational errors (AppError subclasses)
  if (err.isOperational) {
    return reply.code(err.statusCode).send({
      success: false,
      error: err.message,
      details: err.details,
    });
  }

  // Docker API errors
  if (err.statusCode && err.reason) {
    return reply.code(err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500).send({
      success: false,
      error: err.reason || err.message,
      details: err.json || null,
    });
  }

  const isDevelopment = process.env.NODE_ENV === 'development';
  return reply.code(500).send({
    success: false,
    error: "Internal server error",
    details: isDevelopment ? { message: err.message, stack: err.stack } : null,
  });
}

/**
 * Extract base app ID from compose project name
 * Removes instance suffixes like -2, -3, etc.
 * @param {string} composeProject - The compose project name
 * @returns {string} Base app ID without instance suffix
 */
export function getBaseAppId(composeProject) {
  if (!composeProject) return composeProject;
  return composeProject.replace(/-\d+$/, '');
}
