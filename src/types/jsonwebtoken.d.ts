declare module 'jsonwebtoken' {
    import type { JwtPayload, SignOptions, VerifyOptions } from 'jsonwebtoken'; // só se quiser usar os tipos internos, senão ignore
    // Para evitar erros, você pode colocar um export any simples:
    const jwt: any;
    export default jwt;
  }