import { ethers } from "ethers";
import { useState } from "react";

export function CreateQuiz({ quizFactory, provider }) {
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setIsSuccessMessage] = useState(false);

  async function createAQuiz(e) {
    e.preventDefault();
    setError(null);
    setIsSuccessMessage(false);
    const data = new FormData(e.target);
    const question = data.get("question");
    const answer = data.get("answer");
    const option1 = data.get("option-1");
    const option2 = data.get("option-2");
    const option3 = data.get("option-3");
    const option4 = data.get("option-4");
    const salt = data.get("salt");
    const reward = data.get("reward");

    if (
      answer !== option1 &&
      answer !== option2 &&
      answer !== option3 &&
      answer !== option4
    ) {
      setError("The options provided does not include the correct answer");
      return;
    }

    const createQuiz = quizFactory.getFunction("createQuiz");
    setIsLoading(true);
    createQuiz(question, answer, [option1, option2, option3, option4], salt, {
      value: ethers.parseEther(reward),
    })
      .then(async (txResponse) => {
        console.log("Transaction response received:", txResponse);
        setIsLoading(true);
        try {
          const receipt = await provider.waitForTransaction(txResponse.hash);
          console.log(receipt);
          setIsSuccessMessage(
            `Quiz ${receipt.logs[0].topics[1]} was created successfully`
          );
          e.target.reset();
        } catch (err) {
          console.error("Error waiting for transaction to be mined:", error);
          setError(error.code);
        } finally {
          setIsLoading(false);
        }
      })
      .catch((err) => {
        setError(err.code);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }
  return (
    <form onSubmit={createAQuiz} className="form">
      <label htmlFor="question">
        <span>Quiz Question</span>
        <input id="question" name="question" type="text" required />
      </label>
      <label htmlFor="answer">
        <span>Answer</span>
        <input id="answer" name="answer" type="text" required />
      </label>
      <label>
        <span>Options</span>
        <ol>
          <li>
            <input name="option-1" type="text" required />
          </li>
          <li>
            <input name="option-2" type="text" required />
          </li>
          <li>
            <input name="option-3" type="text" required />
          </li>
          <li>
            <input name="option-4" type="text" required />
          </li>
        </ol>
      </label>
      <label htmlFor="salt">
        <span>Salt</span>
        <input id="salt" name="salt" type="text" required />
      </label>
      <label htmlFor="reward">
        <span>Eth Reward</span>
        <input
          id="reward"
          name="reward"
          type="number"
          required
          min={0.011}
          step={0.01}
        />
      </label>

      <button type="submit" disabled={isLoading}>
        Create Quiz
      </button>

      {isLoading && <span className="loading">Loading...</span>}
      {successMessage && <span className="success">{successMessage}</span>}

      {error && <span className="error">{error}</span>}
    </form>
  );
}
