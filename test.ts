// console.log("This is a test file.");

// function Add(a: number, b: number) {
//   return a + b;
// }

// const a = Add(3, 4);
// console.log(a, "data");

// // The Functional Way
// function createUser(name: string, age: number) {
//   return {
//     name: name,
//     age: age,
//     greet: function () {
//       console.log(`Hi, I'm ${this.name} and I'm ${this.age} years old`);
//     },
//   };
// }

// // const user1 = createUser("Alice", 25);
// // user1.greet(); // Hi, I'm Alice

// // The Class Way
// class User {
//   nameq: string;
//   agea: number;

//   // 1. Setup the data (The Blueprint)
//   constructor(name: string, age: number) {
//     this.nameq = name;
//     this.agea = age;
//   }

//   // 2. Define the behavior (The Methods)
//   greet() {
//     console.log(`Hi, I'm ${this.nameq} and ${this.agea}`);
//   }
// }

// // 3. Create the Object (The Instance)
// const user1 = new User("Alice", 25);
// user1.greet(); // Hi, I'm Alice

// // class Car {
// //   brand: string;

// //   constructor(brand: string) {
// //     this.brand = brand;
// //   }

// //   a() {
// //     console.log(`${this.brand} a blah`);
// //   }
// // }

// // class RaceCar extends Car {
// //   b() {
// //     console.log(`${this.brand} b blah`);
// //   }
// // }

// // const myFast = new RaceCar("Fariry");
// // myFast.a();
// // myFast.b();

// class Car {
//   private Car = [
//     { a: "a", b: "b" },
//     { c: "c", d: "d" },
//   ];
//   brand: string;

//   constructor(brand: string) {
//     this.brand = brand;
//   }
//   honk() {
//     console.log("Beep!");
//   }
// }

// // RaceCar gets everything Car has, plus its own features
// class RaceCar extends Car {
//   turbo() {
//     console.log("VROOM!");
//   }
// }

// const myFastCar = new RaceCar("Ferrari");
// myFastCar.honk(); // Beep! (Inherited from Car)
// myFastCar.turbo(); // VROOM! (Unique to RaceCar)

class Library {
  constructor() {
    // We initialize an empty array
    this.books = [];
  }

  // Method to ADD to the array
  addBook(bookName) {
    this.books.push(bookName);
    console.log(`${bookName} added.`);
  }

  // Method to REMOVE from the array
  removeBook(bookName) {
    this.books = this.books.filter((book) => book !== bookName);
    console.log(`${bookName} removed.`);
  }

  // Method to LIST everything
  showBooks() {
    console.log("Current Library:", this.books);
  }
}

const myLibrary = new Library();
myLibrary.addBook("The Hobbit");
myLibrary.addBook("1984");
myLibrary.showBooks(); // ["The Hobbit", "1984"]
myLibrary.removeBook("The Hobbit");
myLibrary.showBooks(); // ["1984"]

class TodoList {
  constructor() {
    this.todos = [
      { id: 1, task: "Learn Classes", completed: false },
      { id: 2, task: "Buy Milk", completed: false },
    ];
  }

  // Update a specific object inside the array
  toggleComplete(id) {
    const task = this.todos.find((item) => item.id === id);
    if (task) {
      task.completed = !task.completed;
      console.log(`Task ${id} is now ${task.completed ? "done" : "pending"}`);
    }
  }
}

const a = new TodoList();
a.toggleComplete(2);
