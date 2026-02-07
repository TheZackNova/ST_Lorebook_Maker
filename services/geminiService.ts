import { GoogleGenAI } from "@google/genai";
import { ApiConfig, GenerationMode } from "../types";

// Initialize Gemini Client
const geminiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });

// ========== Prompt Chế độ chi tiết ==========
const DETAILED_SYSTEM_PROMPT = `Bạn là một nhà thiết kế nhân vật chuyên nghiệp. Trước khi tạo nhân vật, bạn bắt buộc phải phân tích và suy nghĩ.

【BẮT BUỘC THỰC HIỆN】Đầu ra của bạn phải tuân thủ nghiêm ngặt thứ tự sau:
1. Đầu tiên xuất thẻ <Suy_nghĩ>, bên trong đó tiến hành phân tích thiết kế nhân vật.
2. Sau đó xuất thẻ đóng </Suy_nghĩ>.
3. Cuối cùng xuất thẻ <{Tên_NPC}_Chi_Tiết> (Ví dụ: <Uzumaki_Naruto_Chi_Tiết>) bao quanh nội dung thiết lập nhân vật. Thay {Tên_NPC} bằng tên nhân vật viết liền nối bằng dấu gạch dưới.

QUY TẮC THIẾT KẾ QUAN TRỌNG:
- Nếu nhân vật có "Giới tính" là Nữ: Phần "Vóc dáng" / "Ngoại hình" bắt buộc phải đặc tả thêm về 3 vòng (ngực-mông-eo).
- Mục "Sở thích đặc biệt (Fetish/XP)": Phải mô tả về xu hướng tình dục, kiểu chơi. Hãy tham khảo danh sách sau: ['Không', 'M nhẹ', 'S nhẹ', 'M nặng', 'S nặng', 'Thích phô bày', 'Đồng phục', 'Chân (Foot)', 'NTR', 'Thuần ái'].

Không được bỏ qua bước suy nghĩ mà trực tiếp xuất thiết lập nhân vật.`;

const DETAILED_THINKING_TEMPLATE = `
Trong thẻ <Suy_nghĩ>, bạn cần phân tích:
□ Mâu thuẫn cốt lõi của nhân vật này là gì?
□ Cuộc sống thường ngày của nhân vật như thế nào?
□ Nhân vật có những mối quan hệ xã hội nào độc lập với {{user}}?
□ Mặt tích cực và tiêu cực của tính cách thể hiện ra sao?
□ Chi tiết nào làm cho nhân vật trở nên chân thực?

Nguyên tắc thiết kế:
- Nhân vật là một con người hoàn chỉnh, có cuộc sống độc lập.
- Dùng hành động cụ thể để thể hiện tính cách, không dùng tính từ sáo rỗng.
- Dữ liệu đối thoại (corpus) chỉ viết lời thoại, không thêm miêu tả hành động.
- Tính cách bắt buộc phải có hai mặt (ưu/nhược).`;

const DETAILED_OUTPUT_FORMAT = `
Vui lòng xuất theo định dạng YAML dưới đây:

<{Tên_NPC}_Chi_Tiết>
[Thông tin cơ bản]
Họ tên: [Tên đầy đủ]
Giới tính: [Nam/Nữ/Khác]
Tuổi: [Tuổi thực/Tuổi ngoại hình]
Chiều cao: [Chiều cao tổng thể (bao gồm giày/phụ kiện) và chiều cao thực]
Số đo cơ thể: [Mô tả văn học về vóc dáng thay vì chỉ số khô khan. Tập trung vào hình dáng cơ bắp, độ đầy đặn/thon gọn, sự tương tác giữa cơ thể và trang phục bó sát/trang bị, các đường cong đặc thù]
Thân phận: [Chức vụ/Nghề nghiệp công khai]
Thuộc tính cốt lõi: [3-4 từ khóa tóm tắt (Ví dụ: Tsundere, Đồ bó, Kiếm sư, Loli)]
Phe phái: [Tổ chức trực thuộc]
Tình trạng: [Còn trinh/Đã kết hôn/Độc thân/...]

[Vị trí Dấu ấn âm thanh/Năng lượng]
[Mô tả vị trí cụ thể trên cơ thể (thường là nơi gợi cảm hoặc dễ thấy). Mô tả hình dáng, màu sắc và hiệu ứng ánh sáng khi năng lượng tuôn chảy qua da]

[Chi tiết ngoại hình]
- Kiểu tóc: [Màu sắc, kiểu dáng, độ bồng bềnh, phản ứng với môi trường]
- Dung mạo: [Ngũ quan, đặc điểm mắt (màu sắc, thần thái), biểu cảm đặc trưng]
- Trang phục: [Mô tả chi tiết layer quần áo. Chú trọng chất liệu (da, lụa, cao su, kim loại), độ ôm sát cơ thể, các khoảng hở (cut-out) chiến thuật, sự tương phản màu sắc]
- Phụ kiện: [Đuôi, tai (nếu có), vũ khí mang theo, găng tay, trang sức]
- Chân: [Tiêu điểm thị giác phần thân dưới. Mô tả độ săn chắc của đùi/bắp chân, tất (hoặc chân trần), vết hằn của trang phục (nếu có), loại giày và tình trạng đế giày]

[Khả năng Cộng hưởng/Chiến đấu]
- Thuộc tính cộng hưởng: [Hệ (Lôi, Hỏa, Băng...)]
- Tên khả năng: [Tên hán việt hoặc tên kêu]
- Tổng quan khả năng: [Mô tả cơ chế hoạt động của siêu năng lực]
- Phong cách chiến đấu: [Mô tả cách di chuyển, ra đòn. Nhấn mạnh sự tương phản (ví dụ: vũ khí to nhưng người nhỏ, hoặc vẻ ngoài lười biếng nhưng ra đòn nhanh)]

[Đặc điểm tính cách]
Từ khóa: [MBTI + 3 tính từ mô tả tính cách]
- Logic nội tại: [Động lực sống, triết lý cá nhân, điều gì thúc đẩy họ hành động?]
- Giao tiếp nhân tế: [Cách đối xử với người lạ, đồng đội, cấp trên. Mặt nạ xã hội là gì?]
- Cơ chế phòng vệ tâm lý: [Cách họ đối mặt với tổn thương hoặc che giấu điểm yếu]

[Sở thích cá nhân]
- Yêu thích: [Món ăn, hoạt động, sở thích kỳ quặc]
- Ghét: [Thứ gây khó chịu cụ thể]
- Vật trân quý: [Món đồ mang theo bên mình và ý nghĩa quá khứ của nó]

[Thói quen hành vi]
- [Thói quen vô thức khi suy nghĩ/lo lắng]
- [Thói quen khi ăn uống hoặc nghỉ ngơi]
- [Thói quen trong chiến đấu hoặc chuẩn bị hành động]

[Kinh nghiệm cá nhân]
<History_Base>
- [Gạch đầu dòng về quá khứ/nguồn gốc]
- [Sự kiện bước ngoặt thay đổi cuộc đời]
- [Gia nhập tổ chức hiện tại và quá trình thăng tiến]
- [Một sự kiện cụ thể tạo nên mối liên kết hoặc ám ảnh]
- [Tình trạng hiện tại và mục tiêu tương lai]
</History_Base>

[Mối quan hệ]
- [Gia đình]: [Danh sách thành viên gia đình cha, mẹ, anh, chị, em(nếu có)]
- [Nhân vật phụ A]: [Mối quan hệ cụ thể]
- [Vật nuôi/Vũ khí]: [Nếu có tri giác]

[Sở thích tình dục & Tương tác thầm kín]
- Dải nhạy cảm: [Các vùng cơ thể cực kỳ nhạy cảm (tai, đuôi, gáy, đùi trong...)]
- Lối chơi cốt lõi: [Sở thích (ví dụ: Bị kiểm soát, chăm sóc, thô bạo, v.v.)]
- Trạng thái tâm lý: [Biểu hiện khi thân mật: Xấu hổ, chủ động, hay cố kìm nén?]
- Thể chất đặc biệt & Chi tiết tương tác: [
  + Phản ứng sinh lý đặc thù (đổi màu mắt, phát sáng, run rẩy).
  + Cảm giác về xúc giác (nhiệt độ da, mồ hôi, độ mềm).
  + Các phản ứng cụ thể khi đụng chạm vào vùng cấm (Dấu ấn, đuôi, v.v.)
]

[Ví dụ thoại]
- Xuất hiện: "[Câu thoại chào sân đặc trưng]"
- Chiến đấu: "[Câu thoại khi tung chiêu cuối]"
- Tương tác chiến đấu: "[Câu thoại khi bị đánh hoặc hỗ trợ]"
- Xấu hổ: "[Phản ứng khi bị trêu chọc hoặc sự cố trang phục]"
- Quyến rũ/Gợi tình: "[Câu thoại trong tình huống R18/thân mật cao]"
- Tỏ tình: "[Câu thoại bày tỏ tình cảm chân thành]"

[Tin nhắn thiết bị đầu cuối]
[Tên]: [Tin nhắn báo cáo công việc/đời sống]
[Tên]: [Hình ảnh/Mô tả hình ảnh gửi kèm]
[Tên]: [Tin nhắn rủ đi chơi hoặc tâm sự đêm khuya]

[Hiệu chỉnh tương tác: Lưu ý đặc biệt]
- [Lưu ý cho AI khi nhập vai (Roleplay): Cần giữ thái độ gì? Tránh OOC (Out of character) như thế nào?]
- [Cách miêu tả các bộ phận phi nhân loại (nếu có) một cách tự nhiên]
</{Tên_NPC}_Chi_Tiết>`;

// ========== Prompt Chế độ tóm tắt ==========
const BRIEF_SYSTEM_PROMPT = `Bạn là họa sĩ phác thảo nhân vật. Hãy tạo nhanh hồ sơ NPC ngắn gọn và hữu dụng.

【Thứ tự thực hiện】
1. Xuất thẻ <Suy_nghĩ> để định vị cốt lõi trong vòng 30 chữ.
2. Xuất thẻ đóng </Suy_nghĩ>.
3. Xuất thẻ <{Tên_NPC}_Sơ_Lược> (Ví dụ: <Uzumaki_Naruto_Sơ_Lược>) bao quanh bản phác thảo nhân vật. Thay {Tên_NPC} bằng tên nhân vật viết liền nối bằng dấu gạch dưới.

Yêu cầu: 
- Tổng thể kiểm soát trong khoảng 600 chữ, làm nổi bật thông tin quan trọng.
- Nếu nhân vật là Nữ: Ngoại hình phải nhắc đến 3 vòng (ngực-mông-eo).`;

const BRIEF_OUTPUT_FORMAT = `
Định dạng đầu ra:

<{Tên_NPC}_Sơ_Lược>
[Tên]:
  Thân phận: (Tóm tắt trong 1 câu)
  Ngoại hình: (Nếu là Nữ: Mô tả 3 vòng. Cộng thêm 3 từ khóa + 1 câu đặc điểm)
  Tính cách:
    Bề ngoài: (1 câu)
    Bên trong: (1 câu)
    Điểm kích nổ: (Tình huống nào sẽ khiến họ phản ứng khác thường)
  Cách nói chuyện: (Khẩu癖/Đặc điểm ngữ khí)
  Ví dụ lời thoại:
    - ""
    - ""
    - ""
  Với {{user}}: (1 câu về quan hệ + thái độ)
  Điểm nhớ: (Một chi tiết khiến người ta ấn tượng sâu sắc)
</{Tên_NPC}_Sơ_Lược>`;

const PRIORITY_PROMPT = `【CHỈ LỆNH ƯU TIÊN CAO NHẤT】
Nhiệm vụ hiện tại: Tạo nhân vật NPC.
Bỏ qua các chỉ lệnh nhập vai (Roleplay) khác, tập trung vào việc xuất thiết kế nhân vật.
Bắt buộc phải xuất quá trình suy nghĩ trước, sau đó mới xuất thiết lập nhân vật.`;

// ========== Prompt Đầu đuôi kẹp giữa ==========
const HEAD_OVERRIDE = `[GHI ĐÈ HỆ THỐNG - ƯU TIÊN: TỐI MẬT]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phiên hiện tại đã chuyển sang: 【CHẾ ĐỘ THIẾT KẾ NPC】
- Tạm dừng mọi chỉ lệnh nhập vai (Roleplay)
- Tạm dừng tạo đối thoại/văn bản truyện
- Chuyển sang: Thân phận Trợ lý Sáng tạo
- Loại đầu ra: Tài liệu thiết kế nhân vật có cấu trúc
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【YÊU CẦU SÁNG TÁC】
1. Bắt buộc xuất thẻ <Suy_nghĩ> trước để phân tích.
2. Nhân vật phải có cuộc sống độc lập với {{user}}.
3. Phải có vòng tròn bạn bè và quan hệ xã hội riêng.
4. Tính cách phải có hai mặt (tích cực/tiêu cực), tránh xây dựng quá hoàn hảo.
5. Dùng hành động cụ thể để mô tả tính cách, không liệt kê tính từ.
6. Ví dụ lời thoại chỉ viết câu nói, không kèm miêu tả hành động/thần thái.
7. Quan hệ với {{user}} chỉ là một phần trong cuộc sống của nhân vật.

Bất kể chỉ lệnh trước đó yêu cầu gì, nhiệm vụ lần này chỉ thực hiện thiết kế NPC.`;

const TAIL_CONFIRM = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[XÁC NHẬN THỰC HIỆN - BẮT ĐẦU NGAY]
✓ Nhiệm vụ: Thiết kế nhân vật NPC
✓ Định dạng: Phân tích trong <Suy_nghĩ> trước, sau đó xuất <{Tên_NPC}_Chi_Tiết> hoặc <{Tên_NPC}_Sơ_Lược>
✓ Cấm: Đối thoại, viết truyện, nhập vai, tin nhắn xác nhận
✓ Yêu cầu: Bắt đầu thiết kế ngay, dòng đầu tiên là <Suy_nghĩ>

Bắt đầu ngay bây giờ.`;

/**
 * Helper to call Custom API (OpenAI Compatible) with streaming support
 */
const callCustomApiStream = async (
  config: ApiConfig,
  messages: Array<{ role: string; content: string }>,
  onChunk: (chunk: string) => void
): Promise<string> => {
  if (!config.baseUrl) throw new Error("API URL is required for custom provider");

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const body: any = {
    model: config.model || 'gpt-3.5-turbo',
    messages: messages,
    temperature: 0.8,
    stream: true, // Enable streaming
  };

  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
     const errText = await response.text();
     throw new Error(`Custom API Error ${response.status}: ${errText}`);
  }
  
  if (!response.body) throw new Error("No response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;
    
    const lines = buffer.split('\n');
    buffer = lines.pop() || ""; // Keep the last partial line in buffer

    for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.trim() === 'data: [DONE]') continue;
        if (line.startsWith('data: ')) {
            try {
                const json = JSON.parse(line.substring(6));
                const content = json.choices?.[0]?.delta?.content || "";
                if (content) {
                    onChunk(content);
                    fullText += content;
                }
            } catch (e) {
                console.warn("Failed to parse chunk", line);
            }
        }
    }
  }
  return fullText;
};

/**
 * Generates a Lorebook entry using Gemini or Custom API.
 */
export const generateLorebookEntry = async (
  prompt: string,
  config: ApiConfig,
  mode: GenerationMode,
  customTemplateContent: string | undefined,
  onStream?: (text: string) => void
): Promise<{ key: string[]; comment: string; content: string } | null> => {
  let systemPrompt = "";
  if (customTemplateContent) {
    systemPrompt = `Bạn là trợ lý thiết kế nhân vật.
${DETAILED_THINKING_TEMPLATE}

${customTemplateContent}

${HEAD_OVERRIDE}`;
  } else if (mode === 'detailed') {
    systemPrompt = `${DETAILED_SYSTEM_PROMPT}
${DETAILED_THINKING_TEMPLATE}
${DETAILED_OUTPUT_FORMAT}
${HEAD_OVERRIDE}`;
  } else {
    systemPrompt = `${BRIEF_SYSTEM_PROMPT}
${BRIEF_OUTPUT_FORMAT}
${HEAD_OVERRIDE}`;
  }

  // Instruction to force JSON metadata at the end for reliable parsing
  const metadataInstruction = `
\n\n---------------------------------------------------
SAU KHI HOÀN THÀNH TẤT CẢ CÁC PHẦN TRÊN, BẠN BẮT BUỘC PHẢI THÊM MỘT BLOCK JSON Ở CUỐI CÙNG NHƯ SAU ĐỂ HỆ THỐNG ĐỌC TÊN VÀ TỪ KHÓA:
\`\`\`json
{
  "comment": "Tên nhân vật",
  "key": ["Họ Tên", "Tên", "Biệt danh"]
}
\`\`\`
`;

  const fullPrompt = `${PRIORITY_PROMPT}
${prompt}
${metadataInstruction}
${TAIL_CONFIRM}`;

  let accumulatedText = "";
  const handleChunk = (text: string) => {
    accumulatedText += text;
    if (onStream) onStream(accumulatedText);
  };

  try {
    if (config.provider === 'custom') {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: fullPrompt }
      ];
      await callCustomApiStream(config, messages, handleChunk);
    } else {
      // Gemini
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const modelName = 'gemini-3-flash-preview'; 
      
      const responseStream = await ai.models.generateContentStream({
        model: modelName,
        contents: fullPrompt,
        config: {
          systemInstruction: systemPrompt,
        }
      });

      for await (const chunk of responseStream) {
        const text = chunk.text;
        if (text) handleChunk(text);
      }
    }

    // --- Parsing Logic ---

    // 1. Try to extract metadata from JSON block at the end (High reliability for Name/Key)
    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const jsonMatch = accumulatedText.match(jsonRegex);
    let metadata = { comment: "Generated Character", key: [] as string[] };
    
    if (jsonMatch) {
        try {
            metadata = JSON.parse(jsonMatch[1]);
        } catch (e) {
            console.warn("Failed to parse metadata JSON", e);
        }
    }

    // 2. Try to extract content from XML Tag (High reliability for clean content)
    // <TagName_Suffix> content </TagName_Suffix>
    const tagRegex = /<(\w+)_(?:Chi_Tiết|Sơ_Lược|Custom|Detail|Brief)>([\s\S]*?)<\/\1_(?:Chi_Tiết|Sơ_Lược|Custom|Detail|Brief)>/i;
    const xmlMatch = accumulatedText.match(tagRegex);

    let finalContent = accumulatedText;
    let finalComment = metadata.comment;
    let finalKey = metadata.key;

    if (xmlMatch) {
        // If we found the tag, the content is inside.
        finalContent = xmlMatch[2].trim();
        
        // If JSON didn't give us a valid name, we can try to derive it from the tag name
        if (finalComment === "Generated Character") {
            const rawName = xmlMatch[1];
            finalComment = rawName.replace(/_/g, ' ');
            finalKey = [finalComment];
        }
    } else {
        // Fallback: Manually clean up if tags are missing or malformed
        
        // Remove <Suy_nghĩ> block
        finalContent = finalContent.replace(/<Suy_nghĩ>[\s\S]*?<\/Suy_nghĩ>/gi, '').trim();
        
        // Remove the JSON block if it exists in the text
        if (jsonMatch) {
             finalContent = finalContent.replace(jsonMatch[0], '').trim();
        }
    }

    return {
        key: finalKey,
        comment: finalComment,
        content: finalContent
    };

  } catch (error) {
    console.error("Generate Entry Error:", error);
    throw error;
  }
};

/**
 * Generates a list of character names for batch processing.
 */
export const generateCharacterList = async (
    world: string,
    quantity: number,
    config: ApiConfig,
    existingCharacters: string[] = []
): Promise<string[]> => {
    
    let exclusionText = "";
    if (existingCharacters.length > 0) {
        exclusionText = `\nIMPORTANT: Do NOT include these characters as they already exist: ${JSON.stringify(existingCharacters)}. Find DIFFERENT characters.`;
    }

    const prompt = `List ${quantity} famous distinct character names from "${world}". ${exclusionText}
    Return strictly a JSON array of strings. No markdown formatting.
    Example: ["Name 1", "Name 2"]`;

    let text = "";
    if (config.provider === 'custom') {
         await callCustomApiStream(config, [{role: 'user', content: prompt}], (chunk) => text += chunk);
    } else {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: 'application/json'
            }
        });
        text = response.text || "";
    }

    try {
        const jsonText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const list = JSON.parse(jsonText);
        if (Array.isArray(list)) return list;
        return [];
    } catch (e) {
        console.error("Failed to parse character list", e);
        return [];
    }
};
