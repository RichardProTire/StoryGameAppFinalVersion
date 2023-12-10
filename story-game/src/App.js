import React, { useState, useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import { PromptTemplate } from "langchain/prompts";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { RunnableSequence } from "langchain/schema/runnable";
import { StringOutputParser } from "langchain/schema/output_parser";
import axios from 'axios';
// Text/buttons  need text in center, margins, and padding
const Container = styled.div`
  text-align: center;
  margin: 50px;
`;

const WordInput = styled.input`
  margin: 10px;
  padding: 5px;
`;

const Button = styled.button`
  margin: 10px;
  padding: 10px;
  cursor: pointer;
`;

// App object
const App =  () => {
  // word bank containing 3 categories, persons, places and things
  const [wordBank, setWordBank] = useState({
    persons: [], 
    places: [], 
    things: [], 
  });
  // Fetch the initialize word bank from the server. IF server is not running correctly default word bank will not be empty
  const fetchWordBank = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/wordbank');
      console.log(response.data);
      setWordBank(response.data);
    } catch (error) {
      console.error('Error fetching word bank:', error);
    }
  };

  const saveWordBank = async () => {
    try {
      await axios.post('http://localhost:5000/api/wordbank', wordBank);
    } catch (error) {
      console.error('Error saving word bank:', error);
    }
  };

  useEffect(() => {
    fetchWordBank();
  }, []);
  // editing variable
  const [editing, setEditing] = useState({ category: '', index: null });
  // input variables for word bank
  const [personInput, setPersonInput] = useState('');
  const [placeInput, setPlaceInput] = useState('');
  const [thingInput, setThingInput] = useState('');
  // current story variable
  const [currentStory, setCurrentStory] = useState('');
  // guess variable
  const [guess, setGuess] = useState('');
  // Need variables for a countdown 2 Minutes for guessing
  const [counter, setCounter] = useState(120);
  // variables to fix timer useEffect during async tasks
  const startTimerRef = useRef(false);
  const intervalRef = useRef(null);

  // Need gameActive variable to be a trigger for timer and for guessing to stop adding points
  const [gameActive, setGameActive] = useState(false);
  // need varaibles for guessing persons, places and things
  const [guessedPerson, setGuessedPerson] = useState(false);
  const [guessedPlace, setGuessedPlace] = useState(false);
  const [guessedThing, setGuessedThing] = useState(false);
  // default allowed incorrect guesses
  const [maxIncorrectGuesses] = useState(3);
  // counter variable for incorrect guesses
  const [incorrectGuessCount, setIncorrectGuessCount] = useState(0);
  // need a list of guesses to show user their past guesses
  const [guesses, setGuesses] = useState([]);
  // variable to reference current Allowed guesses remaining
  const [lives, setLives] = useState(maxIncorrectGuesses);
  // counter for points
  const [points, setPoints] = useState(0);

  // Timer functionality for countdown
  useEffect(() => {
    // game must be active and Timer reference must be true to start timer
    if (gameActive && startTimerRef.current) {
      intervalRef.current = setInterval(() => {
          // Decrement countdown
          setCounter((prevCountdown) => (prevCountdown > 0 ? prevCountdown - 1 : 0));
      }, 1000);
    } else {
        clearInterval(intervalRef.current);
    }
    //***********************************************TIMER DEPENDANCY HERE************************************************************* */
    // Clear the timer on component unmount or when gameActive changes
    return () => clearInterval(intervalRef.current);
  }, [gameActive]); // Include gameActive as a dependency

  // adding word to appropriate category in word bank trimming whitespace
  const addWord = async (category) => {
    let newWord = '';
    switch (category) {
      case 'persons':
        newWord = personInput.trim();
        setPersonInput('');
        break;
      case 'places':
        newWord = placeInput.trim();
        setPlaceInput('');
        break;
      case 'things':
        newWord = thingInput.trim();
        setThingInput('');
        break;
      default:
        break;
    }
    // when the word is new. Add the new word to the appropriate categories
    if (newWord !== '') {
      setWordBank((prevWordBank) => ({
        ...prevWordBank,
        [category]: [...prevWordBank[category], newWord],
      }));

      await saveWordBank(); // Save the updated word bank to the server
      setEditing({ category: '', index: null });
    }
  };
  // need to be able to remove words from the word bank
  const removeWord = async (category, index) => {
    setWordBank((prevWordBank) => {
      const updatedCategory = [...prevWordBank[category]];
      updatedCategory.splice(index, 1);
      return { ...prevWordBank, [category]: updatedCategory };
    });

    await saveWordBank(); // Save the updated word bank to the server
  };

  // editing functionality based on category and index for persons, places, and things in the word bank
  const handleEdit = (category, index) => {
    setEditing({ category, index });

    // Set the input value for the corresponding category
    switch (category) {
      case 'persons':
        setPersonInput(wordBank[category][index]);
        break;
      case 'places':
        setPlaceInput(wordBank[category][index]);
        break;
      case 'things':
        setThingInput(wordBank[category][index]);
        break;
      default:
        break;
    }
  };
  // saving the edit to update the corresponding category (person, place, and thing)
  const handleSaveEdit = async () => {
    const { category, index } = editing;
    if (category !== '' && index !== null) {
      const updatedCategory = [...wordBank[category]];
      let updatedInput = '';

      switch (category) {
        case 'persons':
          updatedInput = personInput.trim();
          setPersonInput('');
          break;
        case 'places':
          updatedInput = placeInput.trim();
          setPlaceInput('');
          break;
        case 'things':
          updatedInput = thingInput.trim();
          setThingInput('');
          break;
        default:
          break;
      }

      updatedCategory[index] = updatedInput;

      setWordBank((prevWordBank) => ({
        ...prevWordBank,
        [category]: updatedCategory,
      }));

      await saveWordBank(); // Save the updated word bank to the server
      setEditing({ category: '', index: null });
    }
  };
  // Creating a story
  const [personChosen, setPersonChosen] = useState('');
  const [placeChosen, setPlaceChosen] = useState('');
  const [thingChosen, setThingChosen] = useState('');
  const generateStory = async () => {
    //Assign at random a person, place, and thing for the story
    const newPersonChosen = getRandomElement(wordBank.persons);
    const newPlaceChosen = getRandomElement(wordBank.places);
    const newThingChosen = getRandomElement(wordBank.things);
    setPersonChosen(newPersonChosen);
    setPlaceChosen(newPlaceChosen);
    setThingChosen(newThingChosen);
    //******************************************************************************************* */
    //**********************This is where Langchain will be used:******************************** */
    //********************Creating a story that uses a person, place, and thing****************** */
    const model = new ChatOpenAI({openAIApiKey: "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"});
    const promptTemplate = PromptTemplate.fromTemplate("Tell a 1 paragraph funny story that includes the following person, place and thing. But make sure to include your own person, place, and thing that you think is relevant to the story you create: {person}, {place},{thing}");
    const outputParser = new StringOutputParser();
    // use my api key, the prompt that asks for a story, and parse the output to include only the story. 
    const chain = RunnableSequence.from([promptTemplate, model, outputParser]);
    // that sequence is what is using the person place and things from the wordbank that were chosen randomly
    try {
      const result = await chain.invoke({ person: newPersonChosen, place: newPlaceChosen, thing: newThingChosen });
      setCurrentStory(result);
    } catch (error) {
      console.error('Error generating story:', error);
      setCurrentStory('Error generating story. Please try again.');
      return;
    }
    // Clear existing timer
    clearTimeout(counter);
    // Start a timer for the guessing
    setCounter(
      setTimeout(() => {
        endRound();
      }, counter * 120000) 
    ); // 120 second countdown by default

    
    // Reset guessed flags
    setGuessedPerson(false);
    setGuessedPlace(false);
    setGuessedThing(false);

    // Activate the game This will change the gameActive triggering the Timer
    setGameActive(true);
    // force the counter to be 120, and this is when the reference for timer should be set to true
    startTimerRef.current = true;
    setCounter(120);
  };
  // There needs to be an order of events upon the game ending
  const endRound = () => {
    
    // Ensure currentStory is not undefined or null
    if (!currentStory) {
      console.error('Error: currentStory is undefined or null.');
      return;
    }
    
    // The guess and the story need to be converted to lowercase to prevent case sensitivity.
    const lowerCaseGuess = guess.toLowerCase();
        
    console.log("You guessed:", lowerCaseGuess)
    // Check if the guess is correct
    const correctPersonGuess = !guessedPerson && guess.toLowerCase().includes(personChosen.toLowerCase());
    const correctPlaceGuess = !guessedPlace && guess.toLowerCase().includes(placeChosen.toLowerCase());
    const correctThingGuess = !guessedThing && guess.toLowerCase().includes(thingChosen.toLowerCase());
    if (correctPersonGuess || correctPlaceGuess || correctThingGuess) {
      // Update guessed flags
      if (correctPersonGuess) {
        setGuessedPerson(true);
      }
      if (correctPlaceGuess) {
        setGuessedPlace(true);
      }
      if (correctThingGuess) {
        setGuessedThing(true);
      }

      // Check if all elements are guessed
      if (guessedPerson && guessedPlace && guessedThing) {
        // Increment points and reset game variables
        console.log("Person, Place, and Thing all guessed. Generating next story or modifying word bank.");
        setPoints((prevPoints) => prevPoints + 1);
        setIncorrectGuessCount(0);
        setGuess('');
        setGuesses([]); // Reset guesses for the new round
        setLives(maxIncorrectGuesses); // Reset lives for the new round
        setGuessedPerson(false);
        setGuessedPlace(false);
        setGuessedThing(false);
        setCounter(120);
      } else {
        // Notify the console about the correct guess
        console.log('Correct guess! Keep guessing.');
        setPoints((prevPoints) => prevPoints + 1);
        
      }
    } else {
      // Update incorrect guess count and lives
      setIncorrectGuessCount((prevCount) => prevCount + 1);
      setLives((prevLives) => prevLives - 1);

      // Check if maximum incorrect guesses reached
      if (incorrectGuessCount + 1 >= maxIncorrectGuesses) {
        // Notify the Console that the round is ending
        console.log('Maximum incorrect guesses reached. The round is ending.');

        // Reset counters, guess, and generate a new story
        setIncorrectGuessCount(0);
        setGuess('');
        setGuesses([]); // Reset guesses for the new round
        setLives(maxIncorrectGuesses); // Reset lives for the new round
      } else {
        // Notify the user about the incorrect guess and remaining lives
        console.log(
          `Incorrect guess! You have ${
            maxIncorrectGuesses - incorrectGuessCount - 1
          } more guesses. Remaining lives: ${lives - 1}`
        );
      }
    }
    console.log("Did you guessPerson:", guessedPerson);
    console.log("Did you guessPlace:", guessedPlace);
    console.log("Did you guessThing:", guessedThing);
  };
  
  
  
  // need a variable that when the game has ended triggers the endround()
  const handleGuessSubmit = () => {
    if (gameActive) {
      endRound();
    } else {
      // Notify the user that the game is not active as error handling
      console.log('The game is not active. Generate a new story to start playing.');
      setCounter(120);
    }
  };

  // need a way to get random elements of an array
  const getRandomElement = (array) => {
    const randomIndex = Math.floor(Math.random() * array.length);
    return array[randomIndex];
  };

  return (
    <Container>
      <h1>Story Game</h1>
      <div>
        <h2>Add to Word Bank:</h2>
        <WordInput
          type="text"
          placeholder="Person"
          value={personInput}
          onChange={(e) => setPersonInput(e.target.value)}
        />
        <Button onClick={() => handleSaveEdit()}>Save Edit</Button>
        <Button onClick={() => addWord('persons')}>Add Person</Button>
        <ul>
          {wordBank.persons.map((person, index) => (
            <li key={index}>
              {person}
              <Button onClick={() => removeWord('persons', index)}>Remove</Button>
              <Button onClick={() => handleEdit('persons', index)}>Edit</Button>
            </li>
          ))}
        </ul>

        <WordInput
          type="text"
          placeholder="Place"
          value={placeInput}
          onChange={(e) => setPlaceInput(e.target.value)}
        />
        <Button onClick={() => handleSaveEdit()}>Save Edit</Button>
        <Button onClick={() => addWord('places')}>Add Place</Button>
        <ul>
          {wordBank.places.map((place, index) => (
            <li key={index}>
              {place}
              <Button onClick={() => removeWord('places', index)}>Remove</Button>
              <Button onClick={() => handleEdit('places', index)}>Edit</Button>
            </li>
          ))}
        </ul>

        <WordInput
          type="text"
          placeholder="Thing"
          value={thingInput}
          onChange={(e) => setThingInput(e.target.value)}
        />
        <Button onClick={() => handleSaveEdit()}>Save Edit</Button>
        <Button onClick={() => addWord('things')}>Add Thing</Button>
        <ul>
          {wordBank.things.map((thing, index) => (
            <li key={index}>
              {thing}
              <Button onClick={() => removeWord('things', index)}>Remove</Button>
              <Button onClick={() => handleEdit('things', index)}>Edit</Button>
            </li>
          ))}
        </ul>
        </div>
        <div>
        <h2>Generate Story:</h2>
        <Button onClick={() => generateStory()}>Generate Story</Button>
        <p>{currentStory}</p>
      </div>
      <div>
        <h2>Guess the Story:</h2>
        <WordInput
        type="text"
        placeholder="Your guess..."
        value={guess}
        onChange={(e) => setGuess(e.target.value)}
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            handleGuessSubmit();
          }
        }}
      />
      <Button onClick={() => handleGuessSubmit()} disabled={counter === 0 || !gameActive}>
        Submit Guess
      </Button>
      </div>
      <div>
        <h2>Points: {points}</h2>
      </div>
      <div>
        <h2>Countdown: {counter}s</h2>
      </div>
      {counter === 0 || (guessedPerson && guessedPlace && guessedThing) ? (
        <p>No more guesses allowed. The round has ended.</p>
      ) : null}
      <div>
      <h2>Guesses: {gameActive ? guesses.join(', ') : 'Round not active'}</h2>
      </div>
      <div>
        <h2>Lives: {lives}</h2>
      </div>
    </Container>
  );
};

export default App;