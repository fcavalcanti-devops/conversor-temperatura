const convert = require('../convert');

describe('Conversor de Temperatura', () => {

  describe('fahrenheitCelsius', () => {
    it('converte 131°F para 55°C', () => {
      expect(convert.fahrenheitCelsius(131)).toBe(55);
    });

    it('converte 32°F para 0°C', () => {
      expect(convert.fahrenheitCelsius(32)).toBe(0);
    });

    it('converte -40°F para -40°C', () => {
      expect(convert.fahrenheitCelsius(-40)).toBe(-40);
    });

    it('converte 212°F para 100°C', () => {
      expect(convert.fahrenheitCelsius(212)).toBe(100);
    });

    it('converte valor decimal corretamente', () => {
      const resultado = convert.fahrenheitCelsius(98.6);
      expect(resultado).toBeCloseTo(37, 2);
    });
  });

  describe('celsiusFahrenheit', () => {
    it('converte 55°C para 131°F', () => {
      expect(convert.celsiusFahrenheit(55)).toBe(131);
    });

    it('converte 0°C para 32°F', () => {
      expect(convert.celsiusFahrenheit(0)).toBe(32);
    });

    it('converte -40°C para -40°F', () => {
      expect(convert.celsiusFahrenheit(-40)).toBe(-40);
    });

    it('converte 100°C para 212°F', () => {
      expect(convert.celsiusFahrenheit(100)).toBe(212);
    });

    it('converte valor decimal corretamente', () => {
      const resultado = convert.celsiusFahrenheit(37);
      expect(resultado).toBeCloseTo(98.6, 2);
    });
  });
});
