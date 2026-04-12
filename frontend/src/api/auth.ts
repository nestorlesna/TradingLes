import client from './client'

export const authApi = {
  hasUsers: () => client.get<{ has_users: boolean }>('/auth/has-users').then(r => r.data),
  setup: (username: string, password: string) =>
    client.post('/auth/setup', { username, password }).then(r => r.data),
  login: (username: string, password: string) =>
    client.post<{ access_token: string; token_type: string }>('/auth/login', { username, password }).then(r => r.data),
  me: () => client.get<{ id: string; username: string }>('/auth/me').then(r => r.data),
}
