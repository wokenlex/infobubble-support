[Back to the main page](../../README.md)

# Setting Up a Local AI with LM Studio for InfoBubble

This guide will help you set up a free, local artificial intelligence server using LM Studio and connect it to the InfoBubble app. This will allow you to analyze and summarize news completely privately and without API costs, using your Mac's processing power.

### What is LM Studio?
**LM Studio** is a free application for Mac, Windows, and Linux that allows you to easily download, configure, and run large language models (LLMs) locally on your computer. It provides an OpenAI-compatible server, which is ideal for integration with InfoBubble.

### Prerequisites
1.  **LM Studio Application**: Download it from the official website [lmstudio.ai](https://lmstudio.ai/).
2.  **A Powerful Mac**: Local models require a significant amount of RAM (16 GB or more is recommended) and non-Intel Mac.
---

## Step 1: Enable Developer Mode
After installing and launching LM Studio, the first thing to do is enable developer mode. This will grant access to additional settings, including the local server.
![Switch To Developer Mode](1%20-%20Switch%20To%20Developer%20Mode.png)
---

## Step 2: Find and Download a Model
You will need a model that excels at text analysis and summarization. GPT OSS from OpenAI is good as example.

1.  Navigate to the **Discover** tab.
	![Click Discover](2%20-%20Click%20Discover.png)

2.  Use the search bar to find a suitable model. We recommend models like `openai/gpt-oss-20b` or other models with a large context. Look for versions labeled `MMX`.
	![Find the model what will fits you](3%20-%20Find%20the%20model%20what%20will%20fits%20you.png)

3.  Wait for the download to complete. This may take some time depending on the model's size and your internet speed. Sometimes i saw what download speed is slowing down. It this case click stop and then start again - it will reconnect and continue downloading.
	![Wait for download](4%20-%20Wait%20for%20download.png)
	![Download complete](5%20-%20Download%20complete.png)
---

## Step 3: Configure Model Parameters
Proper model configuration is key to quality performance.

1.  Go to the Discover tab and select model settings.
	![Edit default model settings](6%20-%20Edit%20default%20model%20settings.png)

2.  **Most Importantly**: Increase the `Context Length`. Set the value to at least **65536**. This will allow InfoBubble to send large amounts of text for analysis.
	![Change context size](7%20-%20Change%20context%20size.png)

3.  (Optional) You can adjust other parameters, such as `Reasoning`, to improve the quality of the analysis.
	![Change reasoning](8%20-%20Change%20reasoning.png)

---

## Step 4: Start the Local Server
Now that the model is downloaded and configured, start the server so InfoBubble can connect to it.

1.  Use LM Studio icon in your global menu.
2.  Click **Start Server**.
	![Start LLM server in global menu](9%20-%20Start%20LLM%20server%20in%20global%20menu.png)

---
## Step 5: Configure InfoBubble
The final step is to connect InfoBubble to your local server.

1.  Open the InfoBubble `Settings`.
	![Open InfoBubble AI Settings](10%20-%20Open%20InfoBubble%20AI%20Settings.png)

2.  In LM Studio, copy the local server address.
	![Copy address](11%20-%20Copy%20address.png)

3.  Paste this address into the **Server URL** field in the InfoBubble settings.
	![Paste address](12%20-%20Paste%20address.png)

4.  Go back to LM Studio, copy the model identifier, and paste it into the **Model Name** field in InfoBubble.
	![Copy model name and paste in too](13%20-%20Copy%20model%20name%20and%20paste%20in%20too.png)

5.  **Important**: Repeat these same steps for the **Summaries** tab to ensure both analysis and summarization run through the local model. You can use different model for summary (for example, for me, mistral-small is better in text writing).
	![Repeat again in summary settings](14%20-%20Repeat%20again%20in%20summary%20settings.png)

---

## Step 6: Start Processing

1.  Return to LM Studio and ensure the model is loaded into memory. If not, select it at the top and wait for it to load. This can consume a significant amount of RAM.
	![Load model and wait](15%20-%20Load%20model%20and%20wait.png)

2.  In InfoBubble, make sure you have added sources and criteria for analysis.
	![Import some of the sources or use your own](16%20-%20Import%20some%20of%20the%20sources%20or%20use%20your%20own.png)

3.  Click the **▶️ (Play)** button. InfoBubble will begin sending data to your local LM Studio server. The first results may appear after a delay as the model processes the requests.
	![Start and wait for the first results](17%20-%20Start%20and%20wait%20for%20the%20first%20results.png)