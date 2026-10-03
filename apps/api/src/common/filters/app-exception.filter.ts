import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { ErrorCodes, type ApiError, type ApiErrorBody, type ErrorCode } from '@bgp/shared-types';
import type { Response } from 'express';
import { AppError } from '../errors/app-error.js';

const httpStatusCodes: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCodes.ValidationFailed,
  [HttpStatus.UNAUTHORIZED]: ErrorCodes.Unauthorized,
  [HttpStatus.FORBIDDEN]: ErrorCodes.Forbidden,
  [HttpStatus.NOT_FOUND]: ErrorCodes.NotFound,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCodes.RateLimited,
};

export function toApiError(exception: unknown): { status: number; error: ApiError } {
  if (exception instanceof AppError) {
    return { status: exception.httpStatus, error: exception.toApiError() };
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    return {
      status,
      error: { code: httpStatusCodes[status] ?? ErrorCodes.Internal, message: exception.message },
    };
  }
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    error: { code: ErrorCodes.Internal, message: 'Internal server error.' },
  };
}

/** Renders every HTTP failure as `{ error: { code, message } }`. */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const { status, error } = toApiError(exception);
    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? (exception.stack ?? exception.message) : exception,
      );
    }
    const body: ApiErrorBody = { error };
    host.switchToHttp().getResponse<Response>().status(status).json(body);
  }
}
