import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join, extname, basename } from 'path';
import { AppModule } from './app.module';
import * as hbs from 'hbs';
import { ValidationPipe } from '@nestjs/common';
import { readdirSync, readFileSync } from 'fs';
import { OnUnauthorizedExceptionFilter } from './on-unauthorized-exception/on-unauthorized-exception.filter';

function parseCorsOrigins(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function isPrivateIpv4(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const [a, b] = [Number(match[1]), Number(match[2])];
  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 127
  );
}

function isAllowedOrigin(origin: string, allowedSet: Set<string>): boolean {
  if (allowedSet.has(origin)) return true;

  try {
    const url = new URL(origin);
    const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
    if (!isHttp) return false;

    // Always allow local development origins.
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return true;
    }

    // Allow direct server access by private IP (e.g. 192.168.x.x).
    if (
      process.env.CORS_ALLOW_PRIVATE_IP !== 'false' &&
      isPrivateIpv4(url.hostname)
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

async function bootstrap() {
  console.log('🚀 Starting NestJS application...');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const defaultOrigins = [
    'http://localhost:8080',
    'http://localhost:3000',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:3000',
    'http://sopai.kaizenapps.com',
    'https://sopai.kaizenapps.com',
  ];
  const envOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);
  const allowedOrigins = new Set([...defaultOrigins, ...envOrigins]);

  app.enableCors({
    origin: (origin, callback) => {
      // Non-browser clients (curl/Postman) may have no Origin header.
      if (!origin || isAllowedOrigin(origin, allowedOrigins)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin not allowed by CORS: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['Content-Disposition'],
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useGlobalFilters(new OnUnauthorizedExceptionFilter());

  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');
  app.set('view options', { layout: 'layouts/default' });
  registerPartials(hbs, 'views');
  registerHelpers(hbs);
  await app.listen(process.env.PORT || 3000);
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
function caseSwap(string) {
  return string
    .split('-')
    .map((v, i) => (i == 0 && v) || capitalizeFirstLetter(v))
    .join('');
}
function reduceIndex(string) {
  return string === 'index' ? '' : string;
}
function formatSegment(string, only_case_check = false) {
  if (only_case_check) return caseSwap(string);
  return caseSwap(capitalizeFirstLetter(reduceIndex(string)));
}
function registerHelpers(hbs) {
  hbs.registerHelper('escape', function (variable) {
    return (variable || '').replace(/\r\n/g, '\n').replace(/(['"])/g, '\\$1');
  });
  hbs.registerHelper('select', function (selected, options) {
    return options
      .fn(this)
      .replace(
        new RegExp(' value="' + selected + '"'),
        '$& selected="selected"',
      );
  });
  hbs.registerHelper(
    'selectFromList',
    function (matchKey, matchValue, options, key) {
      return options.filter((v) => v[matchKey] === matchValue)?.[0]?.[key];
    },
  );
  hbs.registerHelper(
    'paginationFooter',
    function (payload: { totalPages: number; page: number }, url: string) {
      const prev =
        payload.page >= 1
          ? `<a  href="/${
              url + '?page=' + (payload.page - 1).toString()
            }" >Prev</a>`
          : '';
      const next =
        payload.page + 1 < payload.totalPages
          ? `<a  href="/${
              url + '?page=' + (payload.page + 1).toString()
            }" >Next</a>`
          : '';
      return prev + next;
    },
  );
  hbs.registerHelper('nav-panel', function (current_page, options) {
    return options
      .fn(this)
      .replace(new RegExp('nav-item-' + current_page + '', 'g'), '$& active');
  });
  hbs.registerHelper('ifCond', function (v1, operator, v2, options) {
    switch (operator) {
      case '==':
        return v1 == v2 ? options.fn(this) : options.inverse(this);
      case '===':
        return v1 === v2 ? options.fn(this) : options.inverse(this);
      case '!=':
        return v1 != v2 ? options.fn(this) : options.inverse(this);
      case '!==':
        return v1 !== v2 ? options.fn(this) : options.inverse(this);
      case '<':
        return v1 < v2 ? options.fn(this) : options.inverse(this);
      case '<=':
        return v1 <= v2 ? options.fn(this) : options.inverse(this);
      case '>':
        return v1 > v2 ? options.fn(this) : options.inverse(this);
      case '>=':
        return v1 >= v2 ? options.fn(this) : options.inverse(this);
      case '&&':
        return v1 && v2 ? options.fn(this) : options.inverse(this);
      case '||':
        return v1 || v2 ? options.fn(this) : options.inverse(this);
      default:
        return options.inverse(this);
    }
  });
}
function registerPartials(hbs, folder) {
  const partialsFolder = join(__dirname, '..', folder);
  readdirSync(partialsFolder).reduce((result, partial) => {
    const ext = extname(partial);
    if (!ext) {
      registerPartials(hbs, folder + '/' + partial);
      return;
    }
    const fileFullPath = join(partialsFolder, partial);
    const data = readFileSync(fileFullPath, 'utf-8');
    // Store as `"filename without extension": content`.
    const name =
      folder
        .split('/')
        .slice(1)
        .map((v, i) => formatSegment(v, i == 0))
        .join('') + formatSegment(basename(partial, ext));

    hbs.registerPartial(name, data);
    return result;
  }, {});
}

bootstrap();
