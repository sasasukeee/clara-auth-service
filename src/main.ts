import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,       // önemli
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  //app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Auth Service')
    .setDescription('Authentication & token service')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  //SwaggerModule.setup('docs', app, document, );
  SwaggerModule.setup('docs', app, document, {
    customCss: `
    /* Fix bottom white area */
    html, body {
      background: #121212 !important;
      color: #ffffff !important;
      height: 100% !important;
    }

    /* Swagger container background */
    .swagger-ui {
        background: #121212 !important;
        color: #ffffff !important;
    }

    /* All normal text → fully white */
    .swagger-ui .opblock-summary-description,
    .swagger-ui .opblock-summary-path,
    .swagger-ui .opblock-summary-method,
    .swagger-ui .opblock-title,
    .swagger-ui .model-title,
    .swagger-ui .info *,
    .swagger-ui label,
    .swagger-ui .btn,
    .swagger-ui .responses-inner h4,
    .swagger-ui .response-col_status,
    .swagger-ui .response-col_description,
    .swagger-ui .response-headers,
    .swagger-ui .opblock-tag {
        color: #ffffff !important;
    }

    /* Sidebar */
    .swagger-ui .topbar {
        background: #1e1e1e !important;
        border-bottom: 1px solid #333;
    }

    /* Input boxes */
    .swagger-ui input,
    .swagger-ui select,
    .swagger-ui textarea {
        background: #1e1e1e !important;
        color: #ffffff !important;
        border: 1px solid #444 !important;
    }

    /* Method colors */
    .opblock.opblock-get {
        background: #0d47a1 !important;
    }

    .opblock.opblock-post {
        background: #1b5e20 !important;
    }
  .opblock-section-header{
  background: #000000ff !important;
  }
  .scheme-container{
  color:white !important;
  background: #444444ff !important;
  }
  h4{
    color:white !important;
  }
  p{
    color:white !important;
  }
    .opblock.opblock-put {
        background: #4e342e !important;
    }
    .modal-ux-content{
    color:white;
    background: #444444ff !important;
    }
    .opblock.opblock-delete {
        background: #b71c1c !important;
    }

    /* Response panel */
    .opblock-body,
    .responses-wrapper,
    .model-box {
        background: #181818 !important;
        color: #ffffff !important;
    }
  `,
  });

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 6000);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to bootstrap application', err);
  process.exit(1);
});
