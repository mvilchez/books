-- CreateTable
CREATE TABLE `Book` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `numero_de_paginas` INTEGER NULL,
    `currentPages` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('PENDING', 'READING', 'COMPLETED', 'WISH_LIST') NOT NULL DEFAULT 'PENDING',
    `nota_personal` DOUBLE NULL,
    `ano` INTEGER NOT NULL,
    `ano_publicacion` INTEGER NULL,
    `edition_key` VARCHAR(191) NOT NULL DEFAULT '',
    `open_library_cover_id` INTEGER NULL,
    `open_library_work_id` VARCHAR(32) NULL,
    `isbn_13` VARCHAR(13) NULL,
    `book_format` VARCHAR(191) NULL,
    `metadata_checked_at` DATETIME(3) NULL,
    `series_name` VARCHAR(191) NULL,
    `series_position` DOUBLE NULL,
    `origen` VARCHAR(191) NULL,
    `fecha_inicio` DATETIME(3) NULL,
    `fecha_fin` DATETIME(3) NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `genreId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Book_title_authorId_ano_edition_key_key`(`title`, `authorId`, `ano`, `edition_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `book_metadata_candidates` (
    `id` VARCHAR(191) NOT NULL,
    `book_id` VARCHAR(191) NOT NULL,
    `work_id` VARCHAR(32) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `author_names` TEXT NOT NULL,
    `subjects` TEXT NOT NULL,
    `first_publish_year` INTEGER NULL,
    `cover_id` INTEGER NULL,
    `title_similarity` DOUBLE NOT NULL,
    `author_similarity` DOUBLE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `book_metadata_candidates_book_id_title_similarity_idx`(`book_id`, `title_similarity`),
    UNIQUE INDEX `book_metadata_candidates_book_id_work_id_key`(`book_id`, `work_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tag` (
    `id` VARCHAR(191) NOT NULL,
    `category` ENUM('GENRE', 'FORMAT', 'LANGUAGE', 'SUBJECT', 'MOOD') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `normalized_name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Tag_category_idx`(`category`),
    UNIQUE INDEX `Tag_category_normalized_name_key`(`category`, `normalized_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `book_tags` (
    `book_id` VARCHAR(191) NOT NULL,
    `tag_id` VARCHAR(191) NOT NULL,
    `source` ENUM('LIBRARY', 'OPEN_LIBRARY') NOT NULL DEFAULT 'LIBRARY',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `book_tags_tag_id_source_idx`(`tag_id`, `source`),
    PRIMARY KEY (`book_id`, `tag_id`, `source`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Author` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `wikidata_id` VARCHAR(32) NULL,
    `portrait_url` TEXT NULL,
    `portrait_source_url` TEXT NULL,
    `portrait_artist` TEXT NULL,
    `portrait_license` VARCHAR(191) NULL,
    `portrait_license_url` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Author_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Genre` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Genre_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Book` ADD CONSTRAINT `Book_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `Author`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Book` ADD CONSTRAINT `Book_genreId_fkey` FOREIGN KEY (`genreId`) REFERENCES `Genre`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `book_metadata_candidates` ADD CONSTRAINT `book_metadata_candidates_book_id_fkey` FOREIGN KEY (`book_id`) REFERENCES `Book`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `book_tags` ADD CONSTRAINT `book_tags_book_id_fkey` FOREIGN KEY (`book_id`) REFERENCES `Book`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `book_tags` ADD CONSTRAINT `book_tags_tag_id_fkey` FOREIGN KEY (`tag_id`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
