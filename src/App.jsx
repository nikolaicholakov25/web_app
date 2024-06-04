import "./App.css";
import { ethers } from "ethers";
import { useEffect, useState } from "react";
import { CreateQuiz } from "./CreateQuiz";
// import dotenv from "dotenv";

export const CONTRACT = require("./QuizFactory.json");
export const QUIZ_CONTRACT = require("./Quiz.json");
export const CONTRACT_ADDRESS = "0x0fb58827C9cDf2D3A528bA41dC1878e8ddFB4525";

function App() {
  const [signer, setSigner] = useState();
  const [provider, setProvider] = useState();
  const [activeQuizes, setActiveQuizes] = useState([]);
  const [createQuiz, setCreateQuiz] = useState(false);
  const [accountConnected, setAccountConnected] = useState("");
  const [factoryContract, setFactoryContract] = useState();
  const [currentQuiz, setCurrentQuiz] = useState({
    address: null,
    question: null,
    answers: [],
    contract: null,
    prize: null,
    winner: null,
  });
  const [quizError, setQuizError] = useState(null);
  const [quizIsLoading, setQuizIsLoading] = useState(false);
  const [quizMessage, setQuizMessage] = useState(null);
  const shortenAddress = (address) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  useEffect(() => {
    (async () => {
      setActiveQuizes([]);
      if (!accountConnected || !factoryContract || !signer) return;
      const getAllQuizes = factoryContract.getFunction("getAllQuizes");
      const allQuizes = await getAllQuizes();
      setActiveQuizes(allQuizes);

      factoryContract.on("QuizCreated", async () => {
        const allQuizes = await getAllQuizes();
        setActiveQuizes(allQuizes);
      });
    })();
  }, [accountConnected, factoryContract]);

  // Refetch connected account on reload
  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.on("accountsChanged", (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        connectWallet();
      }
    });
    (async () => {
      window.ethereum
        .request({
          method: "wallet_getPermissions",
          params: [],
        })
        .then((permissions) => {
          if (permissions[0]) {
            window.ethereum
              .request({ method: "eth_requestAccounts" })
              .then(async (acc) => {
                const account = acc[0];
                setAccountConnected(account);
                const provider = new ethers.BrowserProvider(window.ethereum);
                setProvider(provider);
                const signer = await provider.getSigner();
                setSigner(signer);
                const quizFactory = new ethers.Contract(
                  CONTRACT_ADDRESS,
                  CONTRACT.abi,
                  signer
                );
                setFactoryContract(quizFactory);
              })
              .catch((err) => {
                console.log(err);
              });
          }
        })
        .catch((err) => {
          console.log(err);
        });
    })();
  }, []);

  async function connectWallet() {
    if (!window.ethereum) {
      alert("Please Install Metamask");
      return;
    }

    window.ethereum
      .request({
        method: "wallet_switchEthereumChain",
        params: [
          {
            chainId: "0xaa36a7", // Sepolia,
          },
        ],
      })
      .catch((err) => {
        alert("Please switch to Sepolia TestNet");
      });

    const provider = new ethers.BrowserProvider(window.ethereum);
    setProvider(provider);
    const signer = await provider.getSigner().catch((err) => {
      console.log(err.message);
    });

    if (!signer) return;
    setSigner(signer);

    const address = await signer.getAddress();
    setAccountConnected(address);

    const quizFactory = new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT.abi,
      signer
    );

    setFactoryContract(quizFactory);
  }

  async function disconnectWallet() {
    setAccountConnected("");
    setSigner(null);
    setFactoryContract(null);
    setProvider(null);
    setCurrentQuiz({
      address: null,
      question: null,
      answers: [],
      contract: null,
      prize: null,
      winner: null,
    });
    window.ethereum
      .request({
        method: "wallet_revokePermissions",
        params: [
          {
            eth_accounts: {},
          },
        ],
      })
      .catch(() => {});
  }

  function toggleCreateQuiz() {
    setCreateQuiz((quiz) => {
      document.documentElement.style.overflow = !quiz ? "hidden" : "auto";
      return !quiz;
    });
  }

  async function selectQuiz(address) {
    setQuizError(null);
    setQuizMessage(null);
    setQuizIsLoading(false);
    const quizContract = new ethers.Contract(
      address,
      QUIZ_CONTRACT.abi,
      signer
    );

    quizContract.on("QuizNotQuessed", (_address) => {
      if (_address.toLowerCase() !== accountConnected.toLowerCase()) return;
      setQuizIsLoading(false);
      setQuizMessage("Wrong answer");
    });
    quizContract.on("QuizQuessed", async (_address, prize) => {
      const winner = await quizContract.winner();
      setCurrentQuiz((q) => ({ ...q, winner: Number(winner) ? winner : null }));

      if (_address.toLowerCase() !== accountConnected.toLowerCase()) return;

      setQuizIsLoading(false);
      setQuizMessage(`That's right you won ${ethers.formatEther(prize)}ETH`);
    });

    const question = await quizContract.question();
    const answers = await quizContract.getAnswers();
    const winner = await quizContract.winner();
    const prize = ethers.formatEther(
      await quizContract.getCurrentQuizBalance()
    );

    setCurrentQuiz({
      address,
      answers,
      contract: quizContract,
      question,
      prize,
      winner: Number(winner) ? winner : null,
    });
  }

  async function guessQuiz(answer) {
    setQuizIsLoading(true);
    setQuizError(null);
    setQuizMessage(null);
    try {
      const quess = await currentQuiz.contract.guess(answer);
      console.log(quess);
    } catch (err) {
      setQuizError(err.code);
      console.log(err.code);
      setQuizIsLoading(false);
    }
  }

  async function claimPrize() {
    setQuizIsLoading(true);
    setQuizError(null);
    setQuizMessage(null);
    try {
      const tx = await currentQuiz.contract.claimPrize();
      const prize = ethers.formatEther(
        await currentQuiz.contract.getCurrentQuizBalance()
      );
      const receipt = await provider.waitForTransaction(tx.hash);
      console.log(receipt);
      setQuizMessage(`${prize}ETH was sent to your wallet!`);
      setCurrentQuiz((q) => ({ ...q, prize: 0 }));
      console.log(tx);
    } catch (err) {
      setQuizError(err.code);
    } finally {
      setQuizIsLoading(false);
    }
  }

  return (
    <div className="App">
      <header>
        <button
          type="button"
          onClick={toggleCreateQuiz}
          disabled={!accountConnected}
        >
          Create A Quiz
        </button>
        {!accountConnected ? (
          <button type="button" onClick={connectWallet}>
            Connect Wallet
          </button>
        ) : (
          <button type="button" onClick={disconnectWallet}>
            Disconnect {shortenAddress(accountConnected)}
          </button>
        )}
      </header>
      <div className="container">
        {activeQuizes.length > 0 ? (
          <div className="quizes">
            {activeQuizes.map((quizAddress) => (
              <button
                onClick={() => selectQuiz(quizAddress)}
                key={quizAddress}
                type="button"
                disabled={quizIsLoading}
              >
                {shortenAddress(quizAddress)}
              </button>
            ))}
          </div>
        ) : (
          <>
            {accountConnected ? (
              <div>No Active Quizes</div>
            ) : (
              <div>Please connect your wallet</div>
            )}
          </>
        )}

        {currentQuiz.address && (
          <div className="current_quiz">
            <h4>Question: {currentQuiz.question}</h4>
            <span>Prize Pool: {currentQuiz.prize}ETH</span>
            {currentQuiz.winner && <span>Winner: {currentQuiz.winner}</span>}
            {currentQuiz.winner &&
              currentQuiz.winner.toLowerCase() ===
                accountConnected.toLowerCase() && (
                <button type="button" onClick={claimPrize}>
                  Claim Prize
                </button>
              )}
            <ol>
              {currentQuiz.answers.map((a, i) => (
                <li key={`option-${i}`}>
                  <button onClick={() => guessQuiz(a)} type="button">
                    {a}
                  </button>
                </li>
              ))}
            </ol>
            <br />
            {quizError && <span className="error">{quizError}</span>}
            {quizIsLoading && (
              <span className="loading">Loading quiz response...</span>
            )}
            {quizMessage && (
              <span
                className={`${
                  quizMessage === "Wrong answer" ? "error" : "success"
                }`}
              >
                {quizMessage}
              </span>
            )}
          </div>
        )}
      </div>
      {createQuiz && (
        <>
          <div className="modal" onClick={toggleCreateQuiz}></div>
          <CreateQuiz quizFactory={factoryContract} provider={provider} />
        </>
      )}
    </div>
  );
}

export default App;
