import { z } from 'zod'

export const loginSchema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
})

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, '请输入旧密码'),
  newPassword: z
    .string()
    .min(6, '新密码至少为6位')
    .max(64, '新密码不能超过64位'),
})

export const changeUsernameSchema = z.object({
  newUsername: z
    .string()
    .min(3, '用户名至少为 3 位')
    .max(50, '用户名不能超过 50 位'),
  password: z.string().min(1, '请输入当前密码'),
})
