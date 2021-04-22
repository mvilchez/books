<template>
  <div id="app" class="body">
    <book-header />
    <reading
      v-bind:readingBooks="readingBooks"    />
    <read />
  </div>
</template>

<script>
import BookHeader from "@/components/Header.vue";
import Reading from "@/components/Reading.vue";
import Read from "@/components/Read.vue";

export default {
  name: "App",
  components: {
    BookHeader,
    Reading,
    Read,
  },
  data() {
    return {
      readingBooks: [
        {
          id: 1,
          title: "Un fuego sobre el abismo",
          author: "Vernor Vringe",
          quote:
            "Vernor Vinge es una pluma grande, inmensa, cuya formación e ideas han abonado algunas de las mejores novelas de este género jamás escritas. Uno de los pocos escritores vivos que pertenece a la época de los grandes clásicos de la ciencia-ficción, a ese tiempo tan añorado que nos abandona poco a poco, a cuenta gotas, conforme el tiempo avanza inexorable.",
          cover: "fuego_abismo_vernor_vringe.jpg",
          curator: {
            name: "Francisco Martínez Hidalgo",
            place: "Fabulantes",
            url:
              "https://www.fabulantes.com/2014/04/un-fuego-sobre-el-abismo-vernon-vinge/",
          },
        },
        {
          id: 2,
          title: "Las quince primeras vidas de Harry August",
          author: "Claire North",
          quote:
            "Harry August nació en 1919 en el lavabo de señoras de una estación de tren. Su vida no tuvo mayor relevancia: participó en la Segunda Guerra Mundial y volvió a casa a heredar las tierras de sus padres, donde se quedó hasta morir en 1989. Entonces, volvió a nacer otra vez, en 1919, pero con los recuerdos de su anterior vida intactos.",
          cover: "quince-primeras-vidas.jpeg",
          curator: {
            name: "Laura Huelin",
            place: "La Nave Invisible",
            url:
              "https://lanaveinvisible.com/2016/09/01/resena-las-primeras-quince-vidas-de-harry-august/",
          },
        },
      ],
    };
  },
  methods: {
    
  },
};
</script>

<style>
#app {
  font-family: Impact, Haettenschweiler, Charcoal, sans-serif;
  color: #fff;
  font-weight: 400;
}

.row {
  display: flex;
}

.column-2 {
  flex: 15%;
}

.column-10 {
  flex: 85%;
}

.column-6 {
  flex: 50%;
}

.icon {
  width: 35px;
  height: 35px;
}

.see-more-wrapper {
  margin-top: 150px;
  margin-bottom: 30px;
  text-align: center;
}

.see-more-link {
  border: 2px solid #fff;
  border-radius: 22px;
  color: #fff;
  padding: 14px 18px 12px 14px;
  position: relative;
  text-decoration: none;
}
</style>
