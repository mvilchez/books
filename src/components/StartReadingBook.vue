<template>
  <div id="form-add-new-book" class="add-new-book-container">
    <form @submit.prevent="addNewBook" action="/action_page.php">
      <label for="title">Title</label>
      <input
        type="text"
        id="title"
        name="booktitle"
        placeholder="Book title.."
        ref="title"
        v-model="book.title"
        :class="{ 'is-invalid': loading && invalidBookTitle }"
        @focus="resetEstado"
        @keypress="resetEstado"
      />

      <label for="author">Author</label>
      <input
        type="text"
        id="author"
        name="bookauthor"
        placeholder="Author.."
        v-model="book.author"
        :class="{ 'is-invalid': loading && invalidBookAuthor }"
        @focus="resetEstado"
      />

      <label for="cover">Cover</label>
      <input
        type="text"
        id="cover"
        name="bookcover"
        placeholder="Cover.."
        v-model="book.cover"
      />

      <label for="curator">Curator Name</label>
      <input
        type="text"
        id="curatorname"
        name="curatorname"
        placeholder="Curator.."
        v-model="book.curator.name"
      />

      <label for="location">Site</label>
      <input
        type="text"
        id="curatorlocation"
        name="curatorlocation"
        placeholder="Site.."
        v-model="book.curator.place"
      />

      <label for="location">URL</label>
      <input
        type="text"
        id="curatorurl"
        name="curatorurl"
        placeholder="URL.."
        v-model="book.curator.url"
      />

      <label for="origin">Origin</label>
      <select id="origin" name="origin" v-model="book.origin">
        <option value="personal">Personal Collection</option>
        <option value="borrowed">Borrowed</option>
        <option value="ebook">Ebook</option>
      </select>

      <label for="pages">Number of pages</label>
      <input
        type="number"
        id="pages"
        name="pages"
        placeholder="300.."
        v-model="book.pages"
        :class="{ 'is-invalid': loading && invalidNumberOfPages }"
        @focus="resetEstado"
      />

      <label for="genre">Genre</label>
      <select id="genre" name="genre" v-model="book.genre">
        <option value="fiction">Fiction</option>
        <option value="ensayo">Ensayo</option>
        <option value="novela">Novela</option>
      </select>

      <label for="year">Publication</label>
      <input
        type="number"
        id="year"
        name="year"
        placeholder="2021.."
        v-model="book.year"
      />

      <input type="submit" value="Submit" />
    </form>
  </div>
</template>

<script>
export default {
  name: "add-new-book",
  data() {
    return {
      loading: false,
      sucess: false,
      error: false,
      book: {
        title: "",
        author: "",
        origin: "",
        pages: 0,
        genre: "",
        year: 2021,
        quote: "",
        cover: "",
        curator: {
          name: "",
          place: "",
          url: "",
        },
      },
    };
  },
  methods: {
    addNewBook() {
      this.loading = true;
      this.resetEstado();
      // Comprobamos la presencia de errores
      if (
        this.invalidBookTitle ||
        this.invalidBookAuthor ||
        this.invalidNumberOfPages
      ) {
        this.error = true;
        return;
      }
      this.$emit("add-book", this.book);
      this.$refs.title.focus();

      this.error = false;
      this.sucess = true;
      this.loading = false;

      // Restablecemos el valor de la variables
      this.book = {
        title: "",
        author: "",
        origin: "",
        pages: 0,
        genre: "",
        year: 2021,
        quote: "",
        cover: "",
        curator: {
          name: "",
          place: "",
          url: "",
        },
      };
    },
    resetEstado() {
      this.sucess = false;
      this.error = false;
    },
  },
  computed: {
    invalidBookTitle() {
      return this.book.title.length < 1;
    },
    invalidBookAuthor() {
      return this.book.author.length < 1;
    },
    invalidNumberOfPages() {
      return this.book.pages < 0;
    },
  },
};
</script>

<style scoped>
label {
  color: black;
  font-family: "Noto Sans JP", sans-serif;
}

input[type="text"],
input[type="number"],
input[type="date"],
select {
  width: 100%;
  padding: 12px 20px;
  margin: 8px 0;
  display: inline-block;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}

input[type="number"]:focus,
input[type="text"]:focus,
input[type="date"]:focus,
select:focus {
  background-color: lightblue;
}

input[type="submit"] {
  width: 100%;
  background-color: #4caf50;
  color: white;
  padding: 14px 20px;
  margin: 8px 0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

input[type="submit"]:hover {
  background-color: #45a049;
}

.add-new-book-container {
  border-radius: 5px;
  background-color: white;
  padding: 20px;
  max-width: 500px;
}

input[class="is-invalid"] {
  border: 1px solid red;
}
</style>