import { Request } from "express";
import { ParamsDictionary, Query } from "express-serve-static-core";

import { TokenPayload } from "./auth";

export interface TypedRequest<TBody = never> extends Request {
  body: TBody;
}

export interface TypedRequestWithUser<TBody = never> extends Request {
  body: TBody;
  user: TokenPayload;
}

export interface TypedRequestWithParams<
  TBody = never,
  TParams extends ParamsDictionary = ParamsDictionary,
> extends Request {
  body: TBody;
  params: TParams;
}

export interface TypedRequestWithParamsAndUser<
  TBody = never,
  TParams extends ParamsDictionary = ParamsDictionary,
> extends Request {
  body: TBody;
  params: TParams;
  user: TokenPayload;
}

export interface TypedRequestWithBodyAndUser<
  TBody = never,
  TParams extends ParamsDictionary = ParamsDictionary,
> extends Request {
  body: TBody;
  params: TParams;
  user: TokenPayload;
}

export interface TypedRequestWithQuery<
  TBody = never,
  TQuery extends Query = Query,
> extends Request {
  body: TBody;
  query: TQuery;
}

export interface TypedRequestWithQueryAndUser<
  TBody = never,
  TQuery extends Query = Query,
> extends Request {
  body: TBody;
  query: TQuery;
  user: TokenPayload;
}

export interface TypedRequestWithQueryAndParams<
  TQuery extends Query = Query,
  TParams extends ParamsDictionary = ParamsDictionary,
> extends Request {
  query: TQuery;
  params: TParams;
}

export interface TypedRequestFull<
  TBody = never,
  TParams extends ParamsDictionary = ParamsDictionary,
  TQuery extends Query = Query,
> extends Request {
  body: TBody;
  params: TParams;
  query: TQuery;
}

export interface TypedRequestFullWithUser<
  TBody = never,
  TParams extends ParamsDictionary = ParamsDictionary,
  TQuery extends Query = Query,
> extends Request {
  body: TBody;
  params: TParams;
  query: TQuery;
  user: TokenPayload;
}
