-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ReadingStatus" AS ENUM ('PENDING', 'READING', 'COMPLETED', 'WISH_LIST');

-- CreateEnum
CREATE TYPE "BookTagCategory" AS ENUM ('GENRE', 'FORMAT', 'LANGUAGE', 'SUBJECT', 'MOOD');

-- CreateEnum
CREATE TYPE "BookTagSource" AS ENUM ('LIBRARY', 'OPEN_LIBRARY');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "numero_de_paginas" INTEGER,
    "currentPages" INTEGER NOT NULL DEFAULT 0,
    "status" "ReadingStatus" NOT NULL DEFAULT 'PENDING',
    "nota_personal" DOUBLE PRECISION,
    "ano" INTEGER NOT NULL,
    "ano_publicacion" INTEGER,
    "edition_key" TEXT NOT NULL DEFAULT '',
    "open_library_cover_id" INTEGER,
    "open_library_work_id" VARCHAR(32),
    "isbn_13" VARCHAR(13),
    "book_format" VARCHAR(191),
    "metadata_checked_at" TIMESTAMP(3),
    "synopsis" TEXT,
    "synopsis_language" VARCHAR(12),
    "synopsis_source_url" TEXT,
    "synopsis_checked_at" TIMESTAMP(3),
    "series_name" VARCHAR(191),
    "series_position" DOUBLE PRECISION,
    "origen" TEXT,
    "fecha_inicio" TIMESTAMP(3),
    "fecha_fin" TIMESTAMP(3),
    "authorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'marino',
    "genreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_metadata_candidates" (
    "id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "work_id" VARCHAR(32) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "author_names" TEXT NOT NULL,
    "subjects" TEXT NOT NULL,
    "first_publish_year" INTEGER,
    "cover_id" INTEGER,
    "title_similarity" DOUBLE PRECISION NOT NULL,
    "author_similarity" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "book_metadata_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "category" "BookTagCategory" NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "normalized_name" VARCHAR(191) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_tags" (
    "book_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "source" "BookTagSource" NOT NULL DEFAULT 'LIBRARY',
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "book_tags_pkey" PRIMARY KEY ("book_id","tag_id","source")
);

-- CreateTable
CREATE TABLE "Author" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wikidata_id" VARCHAR(32),
    "portrait_url" TEXT,
    "portrait_source_url" TEXT,
    "portrait_artist" TEXT,
    "portrait_license" VARCHAR(191),
    "portrait_license_url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Genre" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Genre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Book_ano_status_idx" ON "Book"("ano", "status");

-- CreateIndex
CREATE INDEX "Book_userId_idx" ON "Book"("userId");

-- CreateIndex
CREATE INDEX "Book_userId_ano_status_idx" ON "Book"("userId", "ano", "status");

-- CreateIndex
CREATE INDEX "Book_userId_status_idx" ON "Book"("userId", "status");

-- CreateIndex
CREATE INDEX "Book_userId_nota_personal_idx" ON "Book"("userId", "nota_personal");

-- CreateIndex
CREATE UNIQUE INDEX "Book_title_authorId_ano_edition_key_key" ON "Book"("title", "authorId", "ano", "edition_key");

-- CreateIndex
CREATE INDEX "book_metadata_candidates_book_id_title_similarity_idx" ON "book_metadata_candidates"("book_id", "title_similarity");

-- CreateIndex
CREATE UNIQUE INDEX "book_metadata_candidates_book_id_work_id_key" ON "book_metadata_candidates"("book_id", "work_id");

-- CreateIndex
CREATE INDEX "Tag_category_idx" ON "Tag"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_category_normalized_name_key" ON "Tag"("category", "normalized_name");

-- CreateIndex
CREATE INDEX "book_tags_tag_id_source_idx" ON "book_tags"("tag_id", "source");

-- CreateIndex
CREATE INDEX "book_tags_deleted_idx" ON "book_tags"("deleted");

-- CreateIndex
CREATE INDEX "book_tags_book_id_deleted_idx" ON "book_tags"("book_id", "deleted");

-- CreateIndex
CREATE INDEX "book_tags_tag_id_deleted_idx" ON "book_tags"("tag_id", "deleted");

-- CreateIndex
CREATE INDEX "book_tags_book_id_source_deleted_idx" ON "book_tags"("book_id", "source", "deleted");

-- CreateIndex
CREATE UNIQUE INDEX "Author_name_key" ON "Author"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_name_key" ON "Genre"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_metadata_candidates" ADD CONSTRAINT "book_metadata_candidates_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_tags" ADD CONSTRAINT "book_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

