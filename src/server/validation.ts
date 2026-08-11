import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { TicketStatus, UserRole } from '../types';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const resetRequestSchema = z.object({
  username: z.string().min(1, 'Username is required'),
});

export const adminRecoverySchema = z.object({
  username: z.string().min(1, 'Username is required'),
  key: z.string().min(1, 'Recovery key is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export const createTicketSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject too long'),
  description: z.string().min(1, 'Description is required').max(10000, 'Description too long'),
  category: z.enum(['Hardware', 'Software', 'Network', 'Access', 'Email', 'Security', 'Other']),
  attachmentName: z.string().optional(),
});

export const updateTicketStatusSchema = z.object({
  newStatus: z.enum(['Pending', 'Assigned', 'In Progress', 'Resolved', 'Closed']),
  notes: z.string().optional(),
});

export const assignTicketSchema = z.object({
  staffUserId: z.string().min(1, 'Staff user ID is required'),
});

export const addCommentSchema = z.object({
  content: z.string().min(1, 'Content is required').max(10000, 'Content too long'),
  isInternal: z.boolean().optional(),
});

export const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50, 'Username too long'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  role: z.enum(['BRANCH_USER', 'IT_STAFF', 'ADMINISTRATOR', 'AUDITOR']),
  email: z.string().email('Invalid email format'),
  branchId: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  role: z.enum(['BRANCH_USER', 'IT_STAFF', 'ADMINISTRATOR', 'AUDITOR']).optional(),
  email: z.string().email('Invalid email format').optional(),
  branchId: z.string().nullable().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  isActive: z.boolean().optional(),
  mustChangePassword: z.boolean().optional(),
});

export const updateAssignmentsSchema = z.object({
  assignments: z.array(z.object({
    branchId: z.string().min(1),
    isPrimary: z.boolean().optional(),
  })),
});

export const createBranchSchema = z.object({
  name: z.string().min(1, 'Branch name is required').max(100, 'Name too long'),
  location: z.string().min(1, 'Location is required').max(200, 'Location too long'),
  code: z.string().min(1, 'Branch code is required').max(20, 'Code too long').optional(),
});

export const updateBranchSchema = z.object({
  name: z.string().min(1, 'Branch name is required').max(100, 'Name too long').optional(),
  location: z.string().min(1, 'Location is required').max(200, 'Location too long').optional(),
  code: z.string().max(20, 'Code too long').optional(),
  isActive: z.boolean().optional(),
});

export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors as Record<string, string[] | undefined>;
      const message = Object.entries(errors)
        .map(([field, msgs]) => `${field}: ${(msgs || []).join(', ')}`)
        .join('; ');
      res.status(400).json({ error: message || 'Validation failed' });
      return;
    }
    req.body = result.data;
    next();
  };
}