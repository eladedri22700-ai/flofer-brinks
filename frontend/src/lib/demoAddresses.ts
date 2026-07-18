/** Dummy addresses for hands-on guided practice (mock maps / OCR). */

export type DemoAddress = {
  customer_name: string;
  address: string;
  place_id?: string;
  category: string;
};

export const DEMO_MANUAL_ADDRESS: DemoAddress = {
  customer_name: "בנק לאומי דיזנגוף (דמו)",
  address: "דיזנגוף 50, תל אביב-יפו",
  place_id: "mock_dizengoff_50",
  category: "bank_branch",
};

export const DEMO_PHOTO_PATH = "/demo/zebra-list.svg";
