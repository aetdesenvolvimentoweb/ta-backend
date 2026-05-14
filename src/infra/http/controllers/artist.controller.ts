import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { CreateArtistUseCase } from "../../../application/use-cases/create-artist.use-case";
import { AuthenticateArtistUseCase } from "../../../application/use-cases/authenticate-artist.use-case";

export const artistController = (
  createArtistUseCase: CreateArtistUseCase,
  authenticateArtistUseCase: AuthenticateArtistUseCase
) => 
  new Elysia({ prefix: "/artists" })
    .use(
      jwt({
        name: 'jwt',
        secret: process.env.JWT_SECRET!
      })
    )
    /**
     * Cadastro de novo artista
     */
    .post("/", async ({ body, jwt }) => {
      const artist = await createArtistUseCase.execute(body);
      
      const token = await jwt.sign({
        sub: artist.id,
        email: artist.email.getValue()
      });

      return {
        artist: {
          id: artist.id,
          name: artist.name,
          email: artist.email.getValue(),
          socials: artist.socials,
          isPremium: artist.isPremium
        },
        token
      };
    }, {
      body: t.Object({
        name: t.String({ minLength: 2 }),
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 8 }),
        socials: t.Optional(t.Record(t.String(), t.String()))
      }),
      detail: {
        summary: "Cadastrar um novo artista",
        tags: ["Artist"]
      }
    })

    /**
     * Login do artista
     */
    .post("/login", async ({ body, jwt }) => {
      const artist = await authenticateArtistUseCase.execute({
        email: body.email,
        passwordInPlainText: body.password
      });
      
      const token = await jwt.sign({
        sub: artist.id,
        email: artist.email.getValue()
      });

      return {
        message: "Login realizado com sucesso",
        artist: {
          id: artist.id,
          name: artist.name,
          email: artist.email.getValue()
        },
        token
      };
    }, {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String()
      }),
      detail: {
        summary: "Autenticar um artista",
        tags: ["Artist"]
      }
    });
