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
