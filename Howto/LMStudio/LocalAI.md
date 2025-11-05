# Howto: Setting Up a Local AI with LM Studio for InfoBubble

This guide walks you through setting up a free, local AI server using LM Studio and connecting it to the InfoBubble app. By doing this, you can analyze and summarize news articles completely privately and without API costs, leveraging your own Mac's processing power.

### What is LM Studio?
**LM Studio** is a free application for Mac, Windows, and Linux that lets you easily download, configure, and run Large Language Models (LLMs) on your computer. It provides an OpenAI-compatible server, which is perfect for integrating with InfoBubble.

### Prerequisites
1.  **LM Studio Application**: Download it from the official website: [lmstudio.ai](https://lmstudio.ai/).
2.  **An Apple Silicon Mac**: Local models perform best on Apple Silicon (M1, M2, M3, M4, M5, …) and require a significant amount of RAM (16 GB is recommended, 32 GB is better).

---

## Step 1: Enable Developer Mode
After installing and launching LM Studio, the first step is to enable developer mode. This gives you access to advanced features, including the local server.

![Switch to Developer Mode](1%20-%20Switch%20to%20Developer%20Mode.png)

---

## Step 2: Find and Download a Model
Next, you need a model that is optimized for text analysis and running on Apple Silicon.

1.  Navigate to the **Discover** tab in LM Studio.
	![Go to Discover section](2%20-%20Go%20to%20Discover%20section.png)

2.  Use the search bar to find a suitable model. For Apple Silicon Macs, it's crucial to look for models with **MLX** in their name, as these are optimized for the platform. A good examples are `google/gemma-3n-e4b`, `ibm/granite-4-h-tiny`, `mistralai/mistral-small-3.2`…
	![Find model by name and type (MLX)](3%20-%20Find%20model%20by%20name%20and%20type%20(MLX).png)

3.  On the right-hand side, you will see a list of available files for the model. Select a version that fits your Mac's RAM. Quantized models (like `4-bit` or `Q4_K_M`) offer a good balance of performance and memory usage.
	![Select model type what will fits your Mac](4%20-%20Select%20model%20type%20what%20will%20fits%20your%20Mac.png)

4.  Click **Download** and wait for it to complete. This may take some time depending on the model's size.
	![Watch how it downloads](5%20-%20Watch%20how%20it%20downloads.png)

---

## Step 3: Configure the Model
Proper configuration is key for handling large documents from InfoBubble.
![Configure downloaded model](6%20-%20Configure%20downloaded%20model.png)
	
Increase the **Context Length**. Set this value as high as your Mac can handle, such as `32768` or `65536`. This allows the model to process long articles without truncation.
![Increase context size as much as your Mac can](7%20-%20Increase%20context%20size%20as%20much%20as%20your%20Mac%20can.png)

---

## Step 4: Start the Local Server
Now, let's start the server that InfoBubble will connect to.

1.  Go to the **Local Server** tab (the `<->` icon).
2.  Ensure your downloaded model is selected at the top.
3.  Click **Start Server**.
	![Start LM Server](8%20-%20Start%20LM%20Server.png)

---

## Step 5: Configure InfoBubble
The final step is to tell InfoBubble where to find your local AI server.

1.  Open the InfoBubble app and go to **Settings**.
	![Go to Infobubble settings](9%20-%20Go%20to%20Infobubble%20settings.png)

2.  In the AI settings tab, copy the server URL from LM Studio and paste it into the **Server URL** field in InfoBubble.
	![Copy and paste LM Studio server URL](10%20-%20Copy%20paste%20LM%20Studio%20server%20URL.png)

3.  Return to LM Studio and copy the **Model Identifier** (shown at the top of the server page).
	![Return to LM Studio and copy model name](11%20-%20Return%20to%20LM%20Studio%20and%20copy%20model%20name.png)

4.  Paste the identifier into the **Model Name** field in InfoBubble's settings.
	![Paste it in Settings](12%20-%20Paste%20it%20in%20Settings.png)

5.  **Important**: Switch to the **Summaries** tab in InfoBubble's settings and repeat the process by pasting the same Server URL and Model Name. This ensures both analysis and summarization run locally. You can also use a different model for summarization if you prefer.
	![Repeat it in summary settings](13%20-%20Repeat%20it%20in%20summary%20settings.png)

---

## Done.

You can now return to the main screen in InfoBubble. Once you start the analysis, InfoBubble will send requests to your local LM Studio server. Enjoy your completely private, local AI-powered news analysis