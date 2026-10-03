import type { PipeTransform } from '@nestjs/common';
import { ErrorCodes } from '@bgp/shared-types';
import type { z } from 'zod';
import { AppError } from '../errors/app-error.js';

export function parseWithSchema<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(ErrorCodes.ValidationFailed, 'Request validation failed.', 400, {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  return result.data;
}

/** Transport-level validation only: shapes and types, never game rules. */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    return parseWithSchema(this.schema, value);
  }
}
