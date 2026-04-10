export interface LoginRequestBody {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface VerifyEmailRequestBody {
  token: string;
}
