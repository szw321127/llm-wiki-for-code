export async function loadDemo() {
  return fetch("/demo").then((response) => response.json());
}
